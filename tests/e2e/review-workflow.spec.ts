import { expect, test } from "@playwright/test";
import { Role } from "../../generated/prisma/enums";
import { appBasePath, expectOnDashboard, loginWithPassword } from "./helpers/auth";
import { seedLocalUser, seedReceiptFixture } from "./helpers/db";

test("admin reviews receipts from dashboard and audit trail reflects changes", async ({ page }) => {
  const runId = Date.now().toString(36);
  const adminEmail = `e2e-review-admin-${runId}@example.com`;
  const financeEmail = `e2e-review-finance-${runId}@example.com`;
  const kenyaName = `Kenya Review ${runId}`;
  const ugandaName = `Uganda Review ${runId}`;

  await seedLocalUser({
    email: adminEmail,
    name: "Review Admin",
    role: Role.GVI_FINANCE_ADMIN,
    password: "AdminPass123",
    mustChangePassword: false,
  });
  await seedLocalUser({
    email: financeEmail,
    name: "Review Finance",
    role: Role.COUNTRY_FINANCE,
    password: "FinancePass123",
    mustChangePassword: false,
  });

  const first = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `KE-RW-${runId}`,
    countryName: kenyaName,
    budgetYearLabel: `2026 Review Workflow ${runId}`,
    budgetItemName: "Travel Review 1",
    amount: 120,
    description: "Receipt to approve",
  });
  const second = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `UG-RW-${runId}`,
    countryName: ugandaName,
    budgetYearLabel: `2026 Review Workflow ${runId}`,
    budgetItemName: "Travel Review 2",
    amount: 240,
    description: "Receipt to flag",
  });

  await loginWithPassword(page, adminEmail, "AdminPass123");
  await expectOnDashboard(page);

  await page.goto(`${appBasePath}/review`);
  await expect(page.getByRole("heading", { name: "Review receipt" })).toBeVisible();

  await page.goto(`${appBasePath}/review/${first.receiptId}`);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("APPROVED")).toBeVisible();

  await page.goto(`${appBasePath}/review/${second.receiptId}`);
  await page.getByPlaceholder("Write a comment").fill("Flagged for missing details");
  await page.getByRole("button", { name: "Flag" }).click();
  await expect(page.getByText("FLAGGED")).toBeVisible();
  await expect(page.getByText("Flagged for missing details")).toBeVisible();
  await page.waitForLoadState("networkidle");

  await page.goto(`${appBasePath}/audit-trail`);
  await expect(page.getByText(first.receiptId)).toBeVisible();
  await expect(page.getByText(second.receiptId)).toBeVisible();
});
