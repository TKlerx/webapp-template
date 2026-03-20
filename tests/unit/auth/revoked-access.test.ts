import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { AuthMethod, Role, ThemePreference, UserStatus } from "../../../generated/prisma/enums";

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { revokeInvalidSsoSession } from "@/lib/auth";

describe("revoked SSO access handling", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("forces logout for an inactive SSO-backed user", async () => {
    cookieStore.get.mockReturnValue({ value: "session_token" });
    prismaMock.session.deleteMany.mockResolvedValue({ count: 1 } as never);

    const result = await revokeInvalidSsoSession({
      id: "user_1",
      email: "user@example.com",
      name: "Jane Doe",
      role: Role.COUNTRY_FINANCE,
      status: UserStatus.INACTIVE,
      authMethod: AuthMethod.SSO,
      mustChangePassword: false,
      themePreference: ThemePreference.LIGHT,
    });

    expect(result).toBe(false);
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { token: "session_token" },
    });
    expect(cookieStore.delete).toHaveBeenCalled();
  });

  it("allows active SSO-backed users to continue", async () => {
    const result = await revokeInvalidSsoSession({
      id: "user_1",
      email: "user@example.com",
      name: "Jane Doe",
      role: Role.COUNTRY_FINANCE,
      status: UserStatus.ACTIVE,
      authMethod: AuthMethod.BOTH,
      mustChangePassword: false,
      themePreference: ThemePreference.LIGHT,
    });

    expect(result).toBe(true);
    expect(prismaMock.session.deleteMany).not.toHaveBeenCalled();
  });
});
