import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { __resetRateLimitStore } from "@/lib/rate-limit";

const {
  requireApiUser,
  getPasswordComplexityErrorMessage,
  hashPassword,
  validatePasswordComplexity,
  verifyPassword,
} = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  getPasswordComplexityErrorMessage: vi.fn(
    () => "Password must contain test requirements.",
  ),
  hashPassword: vi.fn(),
  validatePasswordComplexity: vi.fn(),
  verifyPassword: vi.fn(),
}));

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth", () => ({
  getPasswordComplexityErrorMessage,
  hashPassword,
  validatePasswordComplexity,
  verifyPassword,
}));

vi.mock("@/lib/route-auth", () => ({
  requireApiUser,
}));

vi.mock("@/lib/better-auth", () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

import { POST } from "@/app/api/auth/change-password/route";

describe("change password route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    __resetRateLimitStore();
  });

  it("updates the credential account password and revokes other sessions", async () => {
    requireApiUser.mockResolvedValue({
      user: { id: "user-1", email: "member@example.com" },
    });
    validatePasswordComplexity.mockReturnValue(true);
    prismaMock.account.findUnique.mockResolvedValue({
      password: "stored-hash",
    } as never);
    verifyPassword.mockResolvedValue(true);
    hashPassword.mockResolvedValue("new-hash");
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.account.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockImplementation(async (run) => run(prismaMock));
    getSession.mockResolvedValue({
      user: { id: "user-1" },
      session: { id: "current-session" },
    });

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
          accountId: "user-1",
        },
      },
      select: {
        password: true,
      },
    });
    expect(prismaMock.account.updateMany).toHaveBeenCalledWith({
      where: {
        accountId: "user-1",
        providerId: "credential",
        password: "stored-hash",
      },
      data: {
        password: "new-hash",
      },
    });
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { not: "current-session" } },
    });
    if (!response) {
      throw new Error("Expected response");
    }
    expect(response.status).toBe(200);
  });

  it("lets only one request verified against the same password revoke sessions", async () => {
    requireApiUser.mockResolvedValue({
      user: { id: "user-1", email: "member@example.com" },
    });
    validatePasswordComplexity.mockReturnValue(true);
    let storedHash = "old-hash";
    prismaMock.account.findUnique.mockResolvedValue({
      password: storedHash,
    } as never);

    // Hold both requests until they have read and verified the old hash.
    let release!: () => void;
    const verified = new Promise<void>((resolve) => {
      release = resolve;
    });
    let verifications = 0;
    verifyPassword.mockImplementation(async () => {
      if (++verifications === 2) release();
      await verified;
      return true;
    });
    hashPassword.mockImplementation(async (value: string) => value + "-hash");
    getSession.mockImplementation(
      async ({ headers }: { headers: Headers }) => ({
        user: { id: "user-1" },
        session: { id: headers.get("x-test-session") },
      }),
    );
    prismaMock.$transaction.mockImplementation(async (run) => run(prismaMock));
    prismaMock.account.updateMany.mockImplementation(({ where, data }) => {
      const matches = where?.password === storedHash;
      if (matches) storedHash = String(data.password);
      return Promise.resolve({ count: Number(matches) }) as ReturnType<
        typeof prismaMock.account.updateMany
      >;
    });

    const attempts = ["FirstPass123", "SecondPass123"];
    const responses = await Promise.all(
      attempts.map((newPassword, index) =>
        POST(
          new Request("http://localhost/api/auth/change-password", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-test-session": "session-" + index,
            },
            body: JSON.stringify({
              currentPassword: "OldPass123",
              newPassword,
            }),
          }),
        ),
      ),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
    const winner = responses.findIndex((response) => response.status === 200);
    expect(storedHash).toBe(attempts[winner] + "-hash");
    expect(prismaMock.user.update).toHaveBeenCalledOnce();
    expect(prismaMock.session.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { userId: "user-1", id: { not: "session-" + winner } },
    });
    expect(prismaMock.auditEntry.create).toHaveBeenCalledOnce();
  });

  it("rejects users without a local credential account", async () => {
    requireApiUser.mockResolvedValue({
      user: { id: "user-1", email: "member@example.com" },
    });
    validatePasswordComplexity.mockReturnValue(true);
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
    expect(getSession).not.toHaveBeenCalled();
    if (!response) {
      throw new Error("Expected response");
    }
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Password change is only available for local accounts",
    });
  });

  it("returns explicit complexity requirements for weak passwords", async () => {
    requireApiUser.mockResolvedValue({
      user: { id: "user-1", email: "member@example.com" },
    });
    validatePasswordComplexity.mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: "TempPass123",
          newPassword: "weak",
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(getPasswordComplexityErrorMessage).toHaveBeenCalled();
    expect(prismaMock.account.findUnique).not.toHaveBeenCalled();
    if (!response) {
      throw new Error("Expected response");
    }
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Password must contain test requirements.",
    });
  });

  it("does not consume a shared unauthenticated rate-limit bucket", async () => {
    requireApiUser.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
      }),
    });

    for (let index = 0; index < 10; index += 1) {
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

      expect(response?.status).toBe(401);
    }
  });
});
