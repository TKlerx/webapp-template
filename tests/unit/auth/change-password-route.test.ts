import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";

const { getSessionUser, hashPassword, validatePasswordComplexity, verifyPassword } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  hashPassword: vi.fn(),
  validatePasswordComplexity: vi.fn(),
  verifyPassword: vi.fn(),
}));

const { revokeOtherSessions } = vi.hoisted(() => ({
  revokeOtherSessions: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser,
  hashPassword,
  validatePasswordComplexity,
  verifyPassword,
}));

vi.mock("@/lib/better-auth", () => ({
  auth: {
    api: {
      revokeOtherSessions,
    },
  },
}));

import { POST } from "@/app/api/auth/change-password/route";

describe("change password route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updates the credential account password and revokes other sessions", async () => {
    getSessionUser.mockResolvedValue({ id: "user-1" });
    validatePasswordComplexity.mockReturnValue(true);
    prismaMock.user.findUnique.mockResolvedValue({
      email: "member@example.com",
    } as never);
    prismaMock.account.findUnique.mockResolvedValue({
      password: "stored-hash",
    } as never);
    verifyPassword.mockResolvedValue(true);
    hashPassword.mockResolvedValue("new-hash");
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.account.update.mockResolvedValue({} as never);
    prismaMock.$transaction.mockImplementation(async (operations) =>
      Promise.all(operations as unknown as Promise<unknown>[]),
    );
    revokeOtherSessions.mockResolvedValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "TempPass123",
          newPassword: "NewPass123",
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(prismaMock.account.findUnique).toHaveBeenCalledWith({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: "member@example.com",
        },
      },
      select: {
        password: true,
      },
    });
    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: "member@example.com",
        },
      },
      data: {
        password: "new-hash",
      },
    });
    expect(revokeOtherSessions).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
    expect(response.status).toBe(200);
  });

  it("rejects users without a local credential account", async () => {
    getSessionUser.mockResolvedValue({ id: "user-1" });
    validatePasswordComplexity.mockReturnValue(true);
    prismaMock.user.findUnique.mockResolvedValue({
      email: "member@example.com",
    } as never);
    prismaMock.account.findUnique.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "TempPass123",
          newPassword: "NewPass123",
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(verifyPassword).not.toHaveBeenCalled();
    expect(revokeOtherSessions).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Password change is only available for local accounts",
    });
  });
});
