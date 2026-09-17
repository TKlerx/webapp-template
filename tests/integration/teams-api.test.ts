import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { Role, UserStatus } from "../../generated/prisma/enums";

const { requireApiUser, requireApiUserWithRoles } = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  requireApiUserWithRoles: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/route-auth", () => ({
  requireApiUser,
  requireApiUserWithRoles,
}));

import {
  GET as getTeamsConfig,
  PUT as putTeamsConfig,
} from "@/app/api/integrations/teams/route";
import {
  GET as getTargets,
  POST as postTarget,
} from "@/app/api/integrations/teams/targets/route";
import { DELETE as deleteSubscription } from "@/app/api/integrations/teams/subscriptions/[id]/route";
import { GET as getBackgroundJobs } from "@/app/api/background-jobs/route";
import {
  cleanupHistoricalBackgroundJobPayloads,
  runBackgroundJobPayloadCleanupMaintenance,
} from "@/services/api/background-jobs";

describe("teams integration API", () => {
  beforeEach(() => {
    requireApiUser.mockResolvedValue({
      user: {
        id: "admin-1",
        role: Role.PLATFORM_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    requireApiUserWithRoles.mockResolvedValue({
      user: {
        id: "admin-1",
        role: Role.PLATFORM_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns teams configuration", async () => {
    prismaMock.teamsIntegrationConfig.findFirst.mockResolvedValue({
      id: "cfg-1",
      sendEnabled: true,
      intakeEnabled: false,
      updatedAt: new Date("2026-04-27T10:00:00Z"),
    } as never);
    prismaMock.teamsOutboundMessage.findFirst.mockResolvedValue(null as never);
    prismaMock.teamsInboundMessage.findFirst.mockResolvedValue(null as never);
    prismaMock.teamsOutboundMessage.count.mockResolvedValue(0 as never);
    prismaMock.teamsInboundMessage.count.mockResolvedValue(0 as never);
    prismaMock.teamsOutboundMessage.findMany.mockResolvedValue([] as never);
    prismaMock.teamsInboundMessage.findMany.mockResolvedValue([] as never);

    const response = await getTeamsConfig(
      new Request("http://localhost/api/integrations/teams"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sendEnabled: true,
      intakeEnabled: false,
    });
  });

  it("updates config toggles", async () => {
    prismaMock.teamsIntegrationConfig.findFirst.mockResolvedValue({
      id: "cfg-1",
      sendEnabled: false,
      intakeEnabled: false,
      updatedAt: new Date(),
    } as never);
    prismaMock.teamsIntegrationConfig.update.mockResolvedValue({
      id: "cfg-1",
      sendEnabled: true,
      intakeEnabled: true,
      updatedAt: new Date(),
    } as never);
    prismaMock.teamsOutboundMessage.findFirst.mockResolvedValue(null as never);
    prismaMock.teamsInboundMessage.findFirst.mockResolvedValue(null as never);
    prismaMock.teamsOutboundMessage.count.mockResolvedValue(0 as never);
    prismaMock.teamsInboundMessage.count.mockResolvedValue(0 as never);
    prismaMock.teamsOutboundMessage.findMany.mockResolvedValue([] as never);
    prismaMock.teamsInboundMessage.findMany.mockResolvedValue([] as never);

    const response = await putTeamsConfig(
      new Request("http://localhost/api/integrations/teams", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sendEnabled: true, intakeEnabled: true }),
      }),
    );

    expect(response.status).toBe(200);
  });

  it("preserves validation errors and rejects unknown config fields", async () => {
    const invalidType = await putTeamsConfig(
      new Request("http://localhost/api/integrations/teams", {
        method: "PUT",
        body: JSON.stringify({ sendEnabled: "yes" }),
      }),
    );
    const unknownField = await putTeamsConfig(
      new Request("http://localhost/api/integrations/teams", {
        method: "PUT",
        body: JSON.stringify({ sendEnabled: true, unexpected: true }),
      }),
    );

    expect(invalidType.status).toBe(400);
    await expect(invalidType.json()).resolves.toEqual({
      error: "sendEnabled must be a boolean",
    });
    expect(unknownField.status).toBe(400);
    await expect(unknownField.json()).resolves.toEqual({
      error: "Invalid request body",
    });
    expect(prismaMock.teamsIntegrationConfig.update).not.toHaveBeenCalled();
  });

  it("preserves the delivery target required-fields error", async () => {
    const response = await postTarget(
      new Request("http://localhost/api/integrations/teams/targets", {
        method: "POST",
        body: JSON.stringify({ name: "Alerts", teamId: "team-1" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "name, teamId, and channelId are required",
    });
  });

  it("lists and creates delivery targets", async () => {
    prismaMock.teamsDeliveryTarget.findMany.mockResolvedValue([] as never);
    prismaMock.teamsDeliveryTarget.create.mockResolvedValue({
      id: "target-1",
    } as never);

    const listResponse = await getTargets(
      new Request("http://localhost/api/integrations/teams/targets"),
    );
    expect(listResponse.status).toBe(200);

    const createResponse = await postTarget(
      new Request("http://localhost/api/integrations/teams/targets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Engineering Alerts",
          teamId: "team-1",
          channelId: "channel-1",
        }),
      }),
    );
    expect(createResponse.status).toBe(201);
  });

  it("returns conflict when deleting subscription with inbound history", async () => {
    prismaMock.teamsIntakeSubscription.delete.mockRejectedValue(
      new Error("Foreign key constraint failed"),
    );

    const response = await deleteSubscription(
      new Request(
        "http://localhost/api/integrations/teams/subscriptions/sub-1",
        {
          method: "DELETE",
        },
      ),
      { params: Promise.resolve({ id: "sub-1" }) },
    );
    if (!response) {
      throw new Error("Expected delete subscription response");
    }

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "Subscription has inbound message history and cannot be deleted. Set it inactive instead.",
    });
  });

  it("redacts sensitive background job fields in read response", async () => {
    prismaMock.backgroundJob.findMany.mockResolvedValue([
      {
        id: "job-1",
        jobType: "teams_message_delivery",
        status: "PENDING",
        payload:
          '{"teamsOutboundMessageId":"out-1","delegatedAccessToken":"secret-token"}',
        result: '{"accessToken":"secret-result"}',
        error: null,
        attemptCount: 0,
        availableAt: new Date("2026-06-01T09:00:00Z"),
        startedAt: null,
        lockedAt: null,
        finishedAt: null,
        workerId: null,
        createdByUserId: "admin-1",
        createdAt: new Date("2026-06-01T09:00:00Z"),
        updatedAt: new Date("2026-06-01T09:00:00Z"),
      },
    ] as never);

    const response = await getBackgroundJobs(
      new Request("http://localhost/api/background-jobs"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jobs: [
        {
          payload: {
            teamsOutboundMessageId: "out-1",
            delegatedAccessToken: "[REDACTED]",
          },
          result: {
            accessToken: "[REDACTED]",
          },
        },
      ],
    });
  });

  it("cleans historical token-bearing payloads", async () => {
    prismaMock.backgroundJob.findMany.mockResolvedValue([
      {
        id: "job-legacy-1",
        payload:
          '{"delegatedAccessToken":"old-token","nested":{"apiKey":"abc"}}',
        result: '{"refreshToken":"old-refresh"}',
        error: "failed",
      },
    ] as never);
    prismaMock.backgroundJob.update.mockResolvedValue({
      id: "job-legacy-1",
    } as never);

    const result = await cleanupHistoricalBackgroundJobPayloads();

    expect(result).toMatchObject({ scanned: 1, updated: 1 });
    expect(prismaMock.backgroundJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.stringContaining(
            '"delegatedAccessToken":"[REDACTED]"',
          ),
          result: expect.stringContaining('"refreshToken":"[REDACTED]"'),
        }),
      }),
    );
    await expect(
      runBackgroundJobPayloadCleanupMaintenance(),
    ).resolves.toMatchObject({
      scanned: 1,
      updated: 1,
    });
  });
});
