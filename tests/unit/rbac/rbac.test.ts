import { describe, expect, it } from "vitest";
import { requireAuth, requireRole } from "@/lib/rbac";
import { Role } from "../../../generated/prisma/enums";

describe("rbac helpers", () => {
  it("allows a user with an accepted role", () => {
    expect(() => requireRole({ role: Role.GVI_FINANCE_ADMIN }, [Role.GVI_FINANCE_ADMIN])).not.toThrow();
    expect(() => requireRole({ role: Role.COUNTRY_FINANCE }, [Role.COUNTRY_FINANCE, Role.GVI_FINANCE_ADMIN])).not.toThrow();
  });

  it("rejects a user without an accepted role", () => {
    expect(() => requireRole({ role: Role.COUNTRY_FINANCE }, [Role.GVI_FINANCE_ADMIN])).toThrow("FORBIDDEN");
  });

  it("requires an authenticated user", () => {
    expect(() => requireAuth(null)).toThrow("UNAUTHORIZED");
    expect(requireAuth({ id: "user_1" })).toEqual({ id: "user_1" });
  });
});

