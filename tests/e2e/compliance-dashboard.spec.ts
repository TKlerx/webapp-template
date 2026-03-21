import { expect, test } from "@playwright/test";
import { ReviewStatus, Role } from "../../generated/prisma/enums";
import { appBasePath, expectOnDashboard, loginWithPassword } from "./helpers/auth";
import { seedLocalUser, seedReceiptFixture } from "./helpers/db";

test("admin views compliance dashboard and drills into a country budget", async ({ page }) => {
  const runId = Date.now().toString(36);
  const adminEmail = `e2e-compliance-admin-${runId}@example.com`;
  const countryName = `Kenya Compliance ${runId}`;

  await seedLocalUser({
    email: adminEmail,
    name: "Compliance Admin",
    role: Role.GVI_FINANCE_ADMIN,
    password: "AdminPass123",
    mustChangePassword: false,
  });

  const overBudget = await seedReceiptFixture({
    uploadedByEmail: adminEmail,
    countryCode: `KE-COMP-${runId}`,
    countryName: countryName,
    budgetYearLabel: `2026 Compliance ${runId}`,
    budgetYearStart: "2035-01-01T00:00:00.000Z",
    budgetYearEnd: "2035-12-31T23:59:59.999Z",
    countryBudgetTotal: 100,
    budgetItemName: "Transport",
    amount: 150,
    description: "Over budget receipt",
    reviewStatus: ReviewStatus.APPROVED,
  });

  await loginWithPassword(page, adminEmail, "AdminPass123");
  await expectOnDashboard(page);

  await page.goto(`${appBasePath}/compliance`);
  await page.getByRole("combobox").nth(1).selectOption(overBudget.budgetYearId);
  await expect(page.getByText(countryName)).toBeVisible();
  await expect(page.getByText("Budget 100 EUR | Approved 150 | Total 150")).toBeVisible();
  await expect(page.getByText("150%")).toBeVisible();

  await page.goto(`${appBasePath}/compliance/${overBudget.countryBudgetId}`);
  await expect(page.getByText("Transport")).toBeVisible();
  await expect(page.getByText("Planned 100")).toBeVisible();
  await expect(page.getByText("Actual 150")).toBeVisible();
});
