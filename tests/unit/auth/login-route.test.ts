import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { __resetRateLimitStore } from "@/lib/rate-limit";
import { AuthMethod, Role, UserStatus } from "../../../generated/prisma/enums";

const { signInEmail } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
}));
const { verifyPassword } = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/better-auth", () => ({
  auth: {
    api: {
      signInEmail,
    },
  },
}));

vi.mock("@/lib/better-auth-http", () => ({
  applySetCookieHeaders: vi.fn((response: Response) => response),
}));

vi.mock("@/lib/auth", () => ({
  verifyPassword,
}));

import { POST } from "@/app/api/auth/login/route";

describe("login route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    __resetRateLimitStore();
    vi.unstubAllEnvs();
  });

  it("rejects missing users before Better Auth sign-in", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.account.findUnique.mockResolvedValue(null);
    verifyPassword.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "missing@example.com",
          password: "TempPass123",
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: "missing@example.com" },
    });
    expect(verifyPassword).toHaveBeenCalled();
    expect(signInEmail).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect(prismaMock.auditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: null,
        entityType: "LoginAttempt",
        entityId: expect.any(String),
        details: JSON.stringify({ reason: "invalid_credentials" }),
      }),
    });
  });

  it("delegates password verification to Better Auth for active users", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "member@example.com",
      name: "Member User",
      role: Role.SCOPE_USER,
      authMethod: AuthMethod.LOCAL,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    } as never);
    prismaMock.account.findUnique.mockResolvedValue({
      password: "stored-hash",
    } as never);
    verifyPassword.mockResolvedValue(true);
    prismaMock.user.update.mockResolvedValue({} as never);
    signInEmail.mockResolvedValue(new Response(null, { status: 200 }));

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "Member@Example.com",
          password: "TempPass123",
          redirectTo: null,
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(signInEmail).toHaveBeenCalledWith({
      body: {
        email: "member@example.com",
        password: "TempPass123",
      },
      headers: expect.any(Headers),
      asResponse: true,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: {
        id: "user-1",
        email: "member@example.com",
      },
      redirectTo: "/dashboard",
    });
  });

  it("returns a generic auth failure for inactive accounts", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-2",
      email: "inactive@example.com",
      name: "Inactive User",
      role: Role.SCOPE_USER,
      authMethod: AuthMethod.LOCAL,
      status: UserStatus.INACTIVE,
      mustChangePassword: false,
    } as never);
    prismaMock.account.findUnique.mockResolvedValue({
      password: "stored-hash",
    } as never);
    verifyPassword.mockResolvedValue(true);

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "inactive@example.com",
          password: "TempPass123",
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(401);
    expect(verifyPassword).toHaveBeenCalledWith("TempPass123", "stored-hash");
    expect(signInEmail).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Invalid email or password",
    });
  });

  it("does not reveal inactive status when the password is wrong", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-3",
      email: "inactive@example.com",
      name: "Inactive User",
      role: Role.SCOPE_USER,
      authMethod: AuthMethod.LOCAL,
      status: UserStatus.INACTIVE,
      mustChangePassword: false,
    } as never);
    prismaMock.account.findUnique.mockResolvedValue({
      password: "stored-hash",
    } as never);
    verifyPassword.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "inactive@example.com",
          password: "WrongPass123",
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(401);
    expect(signInEmail).not.toHaveBeenCalled();
    expect(prismaMock.auditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: null,
        entityType: "User",
        entityId: "user-3",
        details: JSON.stringify({ reason: "invalid_credentials" }),
      }),
    });
    await expect(response.json()).resolves.toEqual({
      error: "Invalid email or password",
    });
  });

  it("rate-limits unknown clients by email bucket instead of one global bucket", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.account.findUnique.mockResolvedValue(null);
    verifyPassword.mockResolvedValue(false);

    for (let index = 0; index < 6; index += 1) {
      await POST(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: "bucket-a@example.com",
            password: "TempPass123",
          }),
          headers: { "content-type": "application/json" },
        }),
      );
    }

    const blocked = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "bucket-a@example.com",
          password: "TempPass123",
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(blocked.status).toBe(429);
    expect(prismaMock.auditEntry.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        actorId: null,
        details: JSON.stringify({ reason: "rate_limited" }),
      }),
    });

    const otherAccount = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "bucket-b@example.com",
          password: "TempPass123",
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(otherAccount.status).toBe(401);
  });

  it("audits invalid login payloads without storing credentials", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "missing@example.com", password: "" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(prismaMock.auditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: null,
        details: JSON.stringify({ reason: "invalid_request" }),
      }),
    });
    expect(
      JSON.stringify(prismaMock.auditEntry.create.mock.calls),
    ).not.toContain("missing@example.com");
  });

  it("attempts a failure audit when login throws without swallowing the original error", async () => {
    const failure = new Error("lookup unavailable");
    prismaMock.user.findUnique.mockRejectedValueOnce(failure);
    await expect(
      POST(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "member@example.com",
            password: "wrong-secret",
          }),
        }),
      ),
    ).rejects.toBe(failure);
    expect(prismaMock.auditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: null,
        details: JSON.stringify({ reason: "internal_error" }),
      }),
    });
  });

  it("audits account-level throttling across trusted client IPs", async () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "1");
    vi.stubEnv("TRUST_PROXY_HEADER_SECRET", "test-proxy-secret");
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.account.findUnique.mockResolvedValue(null);
    verifyPassword.mockResolvedValue(false);
    for (let attempt = 1; attempt <= 11; attempt += 1) {
      const response = await POST(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-real-ip": `192.0.2.${attempt}`,
            "x-trusted-proxy-secret": "test-proxy-secret",
          },
          body: JSON.stringify({
            email: "target@example.com",
            password: "wrong-secret",
          }),
        }),
      );
      expect(response.status).toBe(attempt <= 10 ? 401 : 429);
    }
    expect(prismaMock.auditEntry.create).toHaveBeenCalledTimes(11);
    expect(prismaMock.auditEntry.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        actorId: null,
        details: JSON.stringify({ reason: "rate_limited" }),
      }),
    });
    const audits = JSON.stringify(prismaMock.auditEntry.create.mock.calls);
    expect(audits).not.toContain("target@example.com");
    expect(audits).not.toContain("wrong-secret");
  });
});
