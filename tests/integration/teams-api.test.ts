import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { Role, UserStatus } from "../../generated/prisma/enums";

const { requireApiUserWithRoles } = vi.hoisted(() => ({
  requireApiUserWithRoles: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/route-auth", () => ({
  requireApiUserWithRoles,
}));

import { GET as getTeamsConfig, PUT as putTeamsConfig } from "@/app/api/integrations/teams/route";
import { GET as getTargets, POST as postTarget } from "@/app/api/integrations/teams/targets/route";

describe("teams integration API", () => {
  beforeEach(() => {
    requireApiUserWithRoles.mockResolvedValue({
      user: { id: "admin-1", role: Role.PLATFORM_ADMIN, status: UserStatus.ACTIVE },
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

    const response = await getTeamsConfig(new Request("http://localhost/api/integrations/teams"));

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

  it("lists and creates delivery targets", async () => {
    prismaMock.teamsDeliveryTarget.findMany.mockResolvedValue([] as never);
    prismaMock.teamsDeliveryTarget.create.mockResolvedValue({ id: "target-1" } as never);

    const listResponse = await getTargets(new Request("http://localhost/api/integrations/teams/targets"));
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
});
