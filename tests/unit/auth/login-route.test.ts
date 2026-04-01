import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { AuthMethod, Role, UserStatus } from "../../../generated/prisma/enums";

const { signInEmail } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
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

import { POST } from "@/app/api/auth/login/route";

describe("login route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing users before Better Auth sign-in", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

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
    expect(signInEmail).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
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
    prismaMock.user.update.mockResolvedValue({} as never);
    signInEmail.mockResolvedValue(new Response(null, { status: 200 }));

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "Member@Example.com",
          password: "TempPass123",
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
});
