import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { Role } from "../../../generated/prisma/enums";
import type { SessionUser } from "@/lib/auth";

export type CreateBackgroundJobBody = {
  jobType?: string;
  payload?: unknown;
};

const ALLOWED_BACKGROUND_JOB_TYPES = new Set([
  "echo",
  "noop",
  "notification_delivery",
  "inbound_mail_poll",
  "teams_message_delivery",
  "teams_intake_poll",
]);
const MAX_BACKGROUND_JOB_PAYLOAD_LENGTH = 10 * 1024;
const SENSITIVE_JOB_KEYS = new Set([
  "delegatedaccesstoken",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "token",
  "apikey",
  "idtoken",
  "apitoken",
  "sessiontoken",
  "clientsecret",
  "password",
  "secret",
  "cookie",
  "setcookie",
]);

export function safeParseJobJson(value: string | null): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function sanitizeJobValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJobValue(entry));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, entryValue]) => {
        if (
          SENSITIVE_JOB_KEYS.has(key.toLowerCase().replaceAll(/[^a-z0-9]/g, ""))
        ) {
          return [key, "[REDACTED]"];
        }

        return [key, sanitizeJobValue(entryValue)];
      },
    );
    return Object.fromEntries(entries);
  }

  return typeof value === "string"
    ? value.replaceAll(/\b(?:Bearer|Basic)\s+[a-z0-9._~+/-]+=*/gi, "[REDACTED]")
    : value;
}

function sanitizeJobField(value: string | null) {
  return sanitizeJobValue(safeParseJobJson(value));
}

function sanitizeStoredJobJson(value: string | null) {
  if (value === null) return null;
  const parsed = safeParseJobJson(value);
  const sanitized = sanitizeJobValue(parsed);
  return JSON.stringify(sanitized) === JSON.stringify(parsed)
    ? value
    : JSON.stringify(sanitized ?? {});
}

export async function listBackgroundJobsForUser(user: SessionUser) {
  const jobs = await prisma.backgroundJob.findMany({
    where:
      user.role === Role.PLATFORM_ADMIN
        ? undefined
        : { createdByUserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return jobs.map((job) => ({
    id: job.id,
    jobType: job.jobType,
    status: job.status,
    payload: sanitizeJobField(job.payload),
    result: sanitizeJobField(job.result),
    error: sanitizeJobValue(job.error),
    attemptCount: job.attemptCount,
    availableAt: job.availableAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    workerId: job.workerId,
    createdByUserId: job.createdByUserId,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }));
}

export async function createBackgroundJobForUser(
  userId: string,
  body: CreateBackgroundJobBody,
) {
  const jobType = body.jobType?.trim();
  if (!jobType) {
    return { error: jsonError("jobType is required", 400) };
  }

  if (!ALLOWED_BACKGROUND_JOB_TYPES.has(jobType)) {
    return { error: jsonError("Unsupported jobType", 400) };
  }

  const payloadJson = JSON.stringify(body.payload ?? {});
  if (payloadJson.length > MAX_BACKGROUND_JOB_PAYLOAD_LENGTH) {
    return { error: jsonError("payload exceeds 10KB limit", 400) };
  }

  if (JSON.stringify(sanitizeJobValue(body.payload ?? {})) !== payloadJson) {
    return {
      error: jsonError("Job payload must not contain credentials", 400),
    };
  }

  const job = await prisma.backgroundJob.create({
    data: {
      jobType,
      payload: payloadJson,
      createdByUserId: userId,
    },
  });

  return {
    job: {
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      payload: sanitizeJobField(job.payload),
      createdAt: job.createdAt,
    },
  };
}

export async function cleanupHistoricalBackgroundJobPayloads(limit = 200) {
  const pageSize = Math.min(Math.max(Math.trunc(limit) || 200, 1), 1000);
  let cursor: string | undefined;
  let scanned = 0;
  let updated = 0;
  // ponytail: scan history in bounded pages; add a cleanup-version marker if
  // small-team history grows enough to make full maintenance scans expensive.
  while (true) {
    const jobs = await prisma.backgroundJob.findMany({
      select: { id: true, payload: true, result: true, error: true },
      take: pageSize,
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    scanned += jobs.length;
    for (const job of jobs) {
      const data = {
        payload: sanitizeStoredJobJson(job.payload) ?? "{}",
        result: sanitizeStoredJobJson(job.result),
        error:
          typeof job.error === "string"
            ? String(sanitizeJobValue(job.error))
            : job.error,
      };
      if (
        data.payload === job.payload &&
        data.result === job.result &&
        data.error === job.error
      )
        continue;
      await prisma.backgroundJob.update({ where: { id: job.id }, data });
      updated += 1;
    }
    if (jobs.length < pageSize) break;
    cursor = jobs.at(-1)!.id;
  }
  return { scanned, updated };
}

export async function runBackgroundJobPayloadCleanupMaintenance() {
  return cleanupHistoricalBackgroundJobPayloads();
}
