import { afterEach, describe, expect, it, vi } from "vitest";
import { Role, UserStatus } from "../../../generated/prisma/enums";

const { getSessionUser, requireCountryAccess } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  requireCountryAccess: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser,
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return {
    ...actual,
    requireCountryAccess,
  };
});

import { authorizeRoute } from "@/lib/route-auth";

describe("authorizeRoute", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without an authenticated user", async () => {
    getSessionUser.mockResolvedValue(null);

    const result = await authorizeRoute(new Request("http://localhost/api/test"));

    expect("error" in result).toBe(true);
    if ("error" in result) {
      const response = result.error!;
      expect(response.status).toBe(401);
    }
  });

  it("enforces role checks", async () => {
    getSessionUser.mockResolvedValue({
      id: "user-1",
      role: Role.COUNTRY_FINANCE,
      status: UserStatus.ACTIVE,
    });

    const result = await authorizeRoute(new Request("http://localhost/api/test"), {
      roles: [Role.GVI_FINANCE_ADMIN],
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      const response = result.error!;
      expect(response.status).toBe(403);
    }
  });

  it("enforces country-scoped access", async () => {
    getSessionUser.mockResolvedValue({
      id: "user-1",
      role: Role.COUNTRY_FINANCE,
      status: UserStatus.ACTIVE,
    });
    requireCountryAccess.mockResolvedValue(true);

    const result = await authorizeRoute(
      new Request("http://localhost/api/test?countryId=country-1"),
      {
        roles: [Role.COUNTRY_FINANCE],
        countryScoped: true,
      },
    );

    expect(result).toEqual({
      user: {
        id: "user-1",
        role: Role.COUNTRY_FINANCE,
        status: UserStatus.ACTIVE,
      },
    });
    expect(requireCountryAccess).toHaveBeenCalledWith(
      {
        id: "user-1",
        role: Role.COUNTRY_FINANCE,
        status: UserStatus.ACTIVE,
      },
      "country-1",
    );
  });

  it("returns 400 when country scope is required but missing", async () => {
    getSessionUser.mockResolvedValue({
      id: "user-1",
      role: Role.COUNTRY_ADMIN,
      status: UserStatus.ACTIVE,
    });

    const result = await authorizeRoute(new Request("http://localhost/api/test"), {
      roles: [Role.COUNTRY_ADMIN],
      countryScoped: true,
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      const response = result.error!;
      expect(response.status).toBe(400);
    }
  });
});
