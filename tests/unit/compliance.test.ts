import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { ReviewStatus } from "../../generated/prisma/enums";

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

import { getBudgetItemBreakdown, getCountrySummaries } from "@/lib/compliance";

describe("compliance aggregation", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("summarizes approved and total spend per country", async () => {
    prismaMock.countryBudget.findMany.mockResolvedValue([
      {
        id: "cb-1",
        countryId: "country-1",
        totalAmount: 500,
        currency: "EUR",
        country: { name: "Kenya" },
        budgetItems: [
          {
            receipts: [
              { amount: 100, reviewStatus: ReviewStatus.APPROVED },
              { amount: 50, reviewStatus: ReviewStatus.FLAGGED },
            ],
          },
        ],
      },
    ] as never);

    const [summary] = await getCountrySummaries("year-1", "all");

    expect(summary.countryName).toBe("Kenya");
    expect(summary.approvedSpend).toBe(100);
    expect(summary.totalSpend).toBe(150);
    expect(summary.statusCounts.flagged).toBe(1);
  });

  it("builds a nested budget breakdown and detects over-budget items", async () => {
    prismaMock.budgetItem.findMany.mockResolvedValue([
      {
        id: "parent",
        name: "Operations",
        parentId: null,
        plannedAmount: 100,
        receipts: [{ id: "r1", amount: 80, currency: "EUR", date: new Date(), description: "A", reviewStatus: ReviewStatus.APPROVED }],
      },
      {
        id: "child",
        name: "Travel",
        parentId: "parent",
        plannedAmount: 10,
        receipts: [{ id: "r2", amount: 30, currency: "EUR", date: new Date(), description: "B", reviewStatus: ReviewStatus.FLAGGED }],
      },
    ] as never);

    const [root] = await getBudgetItemBreakdown("country-budget-1", "all");

    expect(root.children).toHaveLength(1);
    expect(root.overBudget).toBe(true);
    expect(root.statusCounts.flagged).toBe(1);
  });
});
