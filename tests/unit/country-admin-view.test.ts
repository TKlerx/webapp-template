import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { Role, ReviewStatus, ThemePreference, UserStatus } from "../../generated/prisma/enums";

const { getSessionUser, requireCountryAccess, requireApiUserWithRoles } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  requireCountryAccess: vi.fn(),
  requireApiUserWithRoles: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rbac")>("@/lib/rbac");
  return {
    ...actual,
    requireCountryAccess,
  };
});

vi.mock("@/lib/route-auth", () => ({
  requireApiUserWithRoles,
}));

import { assertReceiptAccess } from "@/lib/receipts";
import { POST as postReview } from "@/app/api/receipts/[id]/review/route";

describe("country admin review access", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("allows country admins to view receipts in their assigned country", async () => {
    prismaMock.receipt.findUnique.mockResolvedValue({
      id: "receipt-1",
      uploadedById: "finance-1",
      reviewStatus: ReviewStatus.FLAGGED,
      uploadedBy: {
        id: "finance-1",
        name: "Finance User",
        email: "finance@example.com",
        role: Role.COUNTRY_FINANCE,
      },
      budgetItem: {
        id: "item-1",
        name: "Travel",
        countryBudget: {
          countryId: "country-1",
          country: { id: "country-1", name: "Kenya", code: "KE" },
          budgetYear: { id: "year-1", label: "2026" },
        },
      },
      reviewComments: [],
      revisions: [],
    } as never);
    requireCountryAccess.mockResolvedValue(true);

    const receipt = await assertReceiptAccess(
      {
        id: "admin-1",
        email: "admin@example.com",
        name: "Country Admin",
        role: Role.COUNTRY_ADMIN,
        status: UserStatus.ACTIVE,
        themePreference: ThemePreference.LIGHT,
        mustChangePassword: false,
        authMethod: "LOCAL",
      },
      "receipt-1",
    );

    expect(receipt.id).toBe("receipt-1");
    expect(requireCountryAccess).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.COUNTRY_ADMIN }),
      "country-1",
    );
  });

  it("prevents country admins from performing review actions", async () => {
    requireApiUserWithRoles.mockResolvedValue({
      error: Response.json({ error: "Not authorized" }, { status: 403 }),
    });

    const response = await postReview(
      new Request("http://localhost/api/receipts/receipt-1/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      }),
      { params: Promise.resolve({ id: "receipt-1" }) },
    );

    if (!response) {
      throw new Error("Expected response");
    }

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Not authorized" });
  });
});
