import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { Role, UserStatus } from "../../../generated/prisma/enums";

const { requireRouteUserWithRoles } = vi.hoisted(() => ({
  requireRouteUserWithRoles: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/services/api/route-context", () => ({
  requireRouteUserWithRoles,
}));

import { PATCH as rolePatch } from "@/app/api/users/[id]/role/route";
import { PATCH as deactivatePatch } from "@/app/api/users/[id]/deactivate/route";

describe("last admin protection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects demoting the last active admin", async () => {
    requireRouteUserWithRoles.mockResolvedValue({
      user: { id: "admin_1", role: Role.PLATFORM_ADMIN },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin_1",
      role: Role.PLATFORM_ADMIN,
    } as never);
    prismaMock.user.count.mockResolvedValue(1);

    const response = await rolePatch(
      new Request("http://localhost/api/users/admin_1/role", {
        method: "PATCH",
        body: JSON.stringify({ role: Role.SCOPE_USER }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "admin_1" }) },
    );

    if (!response) {
      throw new Error("Expected response");
    }
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Cannot change role of the last Admin user",
    });
  });

  it("rejects deactivating the last active admin", async () => {
    requireRouteUserWithRoles.mockResolvedValue({
      user: { id: "admin_1", role: Role.PLATFORM_ADMIN },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "admin_1",
      role: Role.PLATFORM_ADMIN,
      status: UserStatus.ACTIVE,
    } as never);
    prismaMock.user.count.mockResolvedValue(1);

    const response = await deactivatePatch(
      new Request("http://localhost/api/users/admin_1/deactivate", {
        method: "PATCH",
      }),
      {
        params: Promise.resolve({ id: "admin_1" }),
      },
    );

    if (!response) {
      throw new Error("Expected response");
    }
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Cannot deactivate the last Admin user",
    });
  });
});
