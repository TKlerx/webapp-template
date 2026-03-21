import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { Role } from "../../../generated/prisma/enums";

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

import { getUserScopeIds, requireScopeAccess } from "@/lib/rbac";

describe("scope RBAC helpers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns assigned scope ids for a user", async () => {
    prismaMock.userScopeAssignment.findMany.mockResolvedValue([
      { scopeId: "scope-1" },
      { scopeId: "scope-2" },
    ] as never);

    await expect(getUserScopeIds("user-1")).resolves.toEqual(["scope-1", "scope-2"]);
  });

  it("allows platform admins to access any scope", async () => {
    await expect(
      requireScopeAccess({ id: "admin-1", role: Role.PLATFORM_ADMIN }, "scope-1"),
    ).resolves.toBe(true);

    expect(prismaMock.userScopeAssignment.findMany).not.toHaveBeenCalled();
  });

  it("allows scoped users to access assigned scopes only", async () => {
    prismaMock.userScopeAssignment.findMany.mockResolvedValue([{ scopeId: "scope-1" }] as never);

    await expect(
      requireScopeAccess({ id: "user-1", role: Role.SCOPE_USER }, "scope-1"),
    ).resolves.toBe(true);

    await expect(
      requireScopeAccess({ id: "user-1", role: Role.SCOPE_USER }, "scope-2"),
    ).rejects.toThrow("FORBIDDEN");
  });
});
