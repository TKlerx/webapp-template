import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

import {
  createDeliveryTarget,
  getIntegrationStatus,
  getOrCreateTeamsConfig,
  updateTeamsConfig,
} from "@/services/teams/admin";

describe("teams admin service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates singleton config when missing", async () => {
    prismaMock.teamsIntegrationConfig.findFirst.mockResolvedValue(null as never);
    prismaMock.teamsIntegrationConfig.create.mockResolvedValue({
      id: "default",
      sendEnabled: false,
      intakeEnabled: false,
    } as never);

    const config = await getOrCreateTeamsConfig();
    expect(config.id).toBe("default");
  });

  it("updates config toggles", async () => {
    prismaMock.teamsIntegrationConfig.findFirst.mockResolvedValue({
      id: "cfg-1",
      sendEnabled: false,
      intakeEnabled: false,
    } as never);
    prismaMock.teamsIntegrationConfig.update.mockResolvedValue({
      id: "cfg-1",
      sendEnabled: true,
      intakeEnabled: false,
    } as never);

    const config = await updateTeamsConfig({
      actorId: "admin-1",
      sendEnabled: true,
    });

    expect(config.sendEnabled).toBe(true);
    expect(prismaMock.teamsIntegrationConfig.update).toHaveBeenCalled();
  });

  it("creates delivery target", async () => {
    prismaMock.teamsDeliveryTarget.create.mockResolvedValue({
      id: "target-1",
      name: "Engineering Alerts",
    } as never);

    const target = await createDeliveryTarget({
      actorId: "admin-1",
      name: "Engineering Alerts",
      teamId: "team-1",
      channelId: "channel-1",
    });

    if ("error" in target) {
      throw new Error("Expected target creation");
    }
    expect(target.id).toBe("target-1");
  });

  it("computes integration status", async () => {
    prismaMock.teamsIntegrationConfig.findFirst.mockResolvedValue({
      id: "cfg-1",
      sendEnabled: true,
      intakeEnabled: true,
      updatedAt: new Date(),
    } as never);
    prismaMock.teamsOutboundMessage.findFirst.mockResolvedValue({
      updatedAt: new Date("2026-04-27T09:00:00Z"),
    } as never);
    prismaMock.teamsInboundMessage.findFirst.mockResolvedValue({
      updatedAt: new Date("2026-04-27T09:05:00Z"),
    } as never);
    prismaMock.teamsOutboundMessage.count.mockResolvedValue(0 as never);
    prismaMock.teamsInboundMessage.count.mockResolvedValue(1 as never);
    prismaMock.teamsOutboundMessage.findMany.mockResolvedValue([] as never);
    prismaMock.teamsInboundMessage.findMany.mockResolvedValue([] as never);

    const status = await getIntegrationStatus();
    expect(status.sendEnabled).toBe(true);
    expect(status.intakeEnabled).toBe(true);
    expect(status.health.recentIntakeFailures).toBe(1);
  });
});
