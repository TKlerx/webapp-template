import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NotificationEventType } from "../../../generated/prisma/enums";
import {
  createGraphTeamsClient,
  GraphTeamsHttpError,
} from "@/lib/teams/client";
import { getOrCreateTeamsConfig } from "@/services/teams/admin";
import { getFreshTeamsDelegatedAccessToken } from "@/services/teams/consent";

const MAX_TEAMS_CONTENT_BYTES = 28 * 1024;
const DELIVERY_JOB_TYPE = "teams_message_delivery";
const teamsLogger = logger.child({ component: "teams" });

type QueueTeamsInput = {
  actorId: string;
  eventType: NotificationEventType;
  eventId?: string | null;
  payload: Record<string, unknown>;
};

export async function safeQueueTeamsMessages(input: QueueTeamsInput) {
  try {
    await queueTeamsMessages(input);
  } catch (error) {
    teamsLogger.error("teams.queue_failed", {
      error,
      actorId: input.actorId,
      eventType: input.eventType,
      eventId: input.eventId ?? null,
    });
  }
}

export async function queueTeamsMessages(input: QueueTeamsInput) {
  if (!isTeamsFeatureEnabled()) {
    return;
  }

  const config = await getOrCreateTeamsConfig();
  if (!config.sendEnabled) {
    return;
  }

  const targets = await prisma.teamsDeliveryTarget.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (targets.length === 0) {
    return;
  }

  const content = buildTeamsContent(input.eventType, input.payload);
  const prepared = truncateUtf8(content, MAX_TEAMS_CONTENT_BYTES);
  await prisma.$transaction(async (tx) => {
    for (const target of targets) {
      const outbound = await tx.teamsOutboundMessage.create({
        data: {
          targetId: target.id,
          eventType: input.eventType,
          eventId: input.eventId ?? null,
          content: prepared.content,
          contentType: "html",
          truncated: prepared.truncated,
        },
      });

      await tx.backgroundJob.create({
        data: {
          jobType: DELIVERY_JOB_TYPE,
          payload: JSON.stringify({
            teamsOutboundMessageId: outbound.id,
            targetId: target.id,
            teamId: target.teamId,
            channelId: target.channelId,
            content: outbound.content,
            contentType: outbound.contentType,
          }),
          createdByUserId: input.actorId,
        },
      });
    }
  });
}

export async function deliverTeamsMessage(jobId: string) {
  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (job?.jobType !== DELIVERY_JOB_TYPE || job.status !== "IN_PROGRESS") {
    throw new Error("A claimed Teams delivery job is required.");
  }
  const payload: unknown = JSON.parse(job.payload);
  const id = (payload as { teamsOutboundMessageId?: unknown })
    ?.teamsOutboundMessageId;
  if (typeof id !== "string" || !id)
    throw new Error("Invalid Teams delivery job.");

  const send = await prisma.$transaction(
    async (tx) => {
      const outbound = await tx.teamsOutboundMessage.findUnique({
        where: { id },
        include: { target: { include: { createdBy: true } } },
      });
      if (!outbound) throw new Error("Teams outbound message is missing.");
      if (outbound.status === "SENT")
        return { receipt: outbound.graphMessageId };
      if (outbound.sendReservedAt) {
        throw new Error(
          "Teams send outcome is unknown. Check the channel before resending.",
        );
      }
      const config = await tx.teamsIntegrationConfig.findFirst({
        orderBy: { createdAt: "asc" },
      });
      const target = outbound.target;
      if (!isTeamsFeatureEnabled() || !config?.sendEnabled || !target.active) {
        throw new Error("Teams delivery is disabled.");
      }
      if (
        target.createdBy.status !== "ACTIVE" ||
        target.createdBy.role !== "PLATFORM_ADMIN"
      ) {
        throw new Error(
          "Teams target owner must be an active platform administrator.",
        );
      }
      const delegatedAccessToken = await getFreshTeamsDelegatedAccessToken(
        target.createdByUserId,
        tx,
      );
      if (!delegatedAccessToken)
        throw new Error("Teams target owner must reconnect delegated consent.");
      const client = createGraphTeamsClient({ delegatedAccessToken });
      const reservedAt = new Date();
      const reservation = await tx.teamsOutboundMessage.updateMany({
        where: { id, sendReservedAt: null, status: { not: "SENT" } },
        data: { sendReservedAt: reservedAt },
      });
      if (reservation.count !== 1)
        throw new Error("Teams message is already being delivered.");

      return {
        client,
        reservedAt,
        request: {
          teamId: target.teamId,
          channelId: target.channelId,
          content: outbound.content,
          contentType:
            outbound.contentType === "text"
              ? ("text" as const)
              : ("html" as const),
        },
      };
    },
    { timeout: 35_000 },
  );

  if ("receipt" in send) return { id: send.receipt };

  let response;
  try {
    response = await send.client.sendChannelMessage(send.request);
  } catch (error) {
    if (
      error instanceof GraphTeamsHttpError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 408
    ) {
      await prisma.teamsOutboundMessage.updateMany({
        where: { id, sendReservedAt: send.reservedAt },
        data: { sendReservedAt: null },
      });
    }
    throw error;
  }

  await prisma.teamsOutboundMessage.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      graphMessageId: response.messageId,
      sendReservedAt: null,
      lastError: null,
    },
  });
  return { id: response.messageId };
}

function buildTeamsContent(
  eventType: NotificationEventType,
  payload: Record<string, unknown>,
) {
  const lines = [`<strong>${eventType}</strong>`];
  for (const [key, value] of Object.entries(payload)) {
    lines.push(
      `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value ?? ""))}</div>`,
    );
  }

  return lines.join("");
}

function escapeHtml(value: string) {
  const htmlEntityMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (char) => htmlEntityMap[char] ?? char);
}

function truncateUtf8(value: string, maxBytes: number) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  if (bytes.length <= maxBytes) return { content: value, truncated: false };
  const marker = "...";
  const end = maxBytes - marker.length;
  let boundary = end;
  while (boundary > 0 && (bytes[boundary] & 0xc0) === 0x80) boundary--;
  return {
    content: new TextDecoder().decode(bytes.subarray(0, boundary)) + marker,
    truncated: true,
  };
}

function isTeamsFeatureEnabled() {
  const value = (process.env.TEAMS_ENABLED ?? "false").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
