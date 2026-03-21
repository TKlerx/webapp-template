import { expect, test } from "@playwright/test";
import { Role } from "../../generated/prisma/enums";
import { appBasePath, expectOnDashboard, loginWithPassword } from "./helpers/auth";
import { seedLocalUser, seedReceiptFixture } from "./helpers/db";

test("admin views audit trail entries and exports CSV", async ({ page }) => {
  const runId = Date.now().toString(36);
  const adminEmail = `e2e-audit-admin-${runId}@example.com`;
  const financeEmail = `e2e-audit-finance-${runId}@example.com`;

  await seedLocalUser({
    email: adminEmail,
    name: "Audit Admin",
    role: Role.GVI_FINANCE_ADMIN,
    password: "AdminPass123",
    mustChangePassword: false,
  });
  await seedLocalUser({
    email: financeEmail,
    name: "Audit Finance",
    role: Role.COUNTRY_FINANCE,
    password: "FinancePass123",
    mustChangePassword: false,
  });
  const receipt = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `KE-AUDIT-${runId}`,
    countryName: `Kenya Audit ${runId}`,
    budgetYearLabel: `2026 Audit ${runId}`,
    budgetItemName: "Audit Receipt",
    amount: 95,
    description: "Receipt for audit trail validation",
  });

  await loginWithPassword(page, adminEmail, "AdminPass123");
  await expectOnDashboard(page);

  await page.goto(`${appBasePath}/review/${receipt.receiptId}`);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("APPROVED")).toBeVisible();

  await page.goto(`${appBasePath}/audit-trail`);
  await expect(page.getByRole("cell", { name: `receipt ${receipt.receiptId}` })).toBeVisible({ timeout: 15000 });

  await page.getByPlaceholder("Action").fill("RECEIPT_REVIEWED");
  await expect(page.getByRole("cell", { name: `receipt ${receipt.receiptId}` })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("cell", { name: "RECEIPT_REVIEWED" }).first()).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV" }).click(),
  ]);

  expect(await download.suggestedFilename()).toBe("audit-trail.csv");
});
