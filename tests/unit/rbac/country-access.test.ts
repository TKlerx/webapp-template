import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { Role } from "../../../generated/prisma/enums";

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

import { getUserCountryIds, requireCountryAccess } from "@/lib/rbac";

describe("country-scoped RBAC helpers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns assigned country ids for a user", async () => {
    prismaMock.userCountryAssignment.findMany.mockResolvedValue([
      { countryId: "country-1" },
      { countryId: "country-2" },
    ] as never);

    await expect(getUserCountryIds("user-1")).resolves.toEqual(["country-1", "country-2"]);
  });

  it("allows GVI finance admins to access any country", async () => {
    await expect(
      requireCountryAccess({ id: "admin-1", role: Role.GVI_FINANCE_ADMIN }, "country-1"),
    ).resolves.toBe(true);

    expect(prismaMock.userCountryAssignment.findMany).not.toHaveBeenCalled();
  });

  it("allows country-scoped users to access assigned countries only", async () => {
    prismaMock.userCountryAssignment.findMany.mockResolvedValue([{ countryId: "country-1" }] as never);

    await expect(
      requireCountryAccess({ id: "user-1", role: Role.COUNTRY_FINANCE }, "country-1"),
    ).resolves.toBe(true);

    await expect(
      requireCountryAccess({ id: "user-1", role: Role.COUNTRY_FINANCE }, "country-2"),
    ).rejects.toThrow("FORBIDDEN");
  });
});
