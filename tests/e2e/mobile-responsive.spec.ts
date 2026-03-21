import { expect, test } from "@playwright/test";
import { AuditAction, ReviewStatus, Role } from "../../generated/prisma/enums";
import { appBasePath, expectOnDashboard, loginWithPassword } from "./helpers/auth";
import { addAuditEntryFixture, seedLocalUser, seedReceiptFixture } from "./helpers/db";

test.use({
  viewport: { width: 390, height: 844 },
});

test("mobile viewport renders review, detail, audit, and compliance flows", async ({ page }) => {
  const runId = Date.now().toString(36);
  const adminEmail = `e2e-mobile-admin-${runId}@example.com`;
  const countryName = `Kenya Mobile ${runId}`;

  await seedLocalUser({
    email: adminEmail,
    name: "Mobile Admin",
    role: Role.GVI_FINANCE_ADMIN,
    password: "AdminPass123",
    mustChangePassword: false,
  });

  const receipt = await seedReceiptFixture({
    uploadedByEmail: adminEmail,
    countryCode: `KE-MOBILE-${runId}`,
    countryName,
    budgetYearLabel: `2026 Mobile ${runId}`,
    budgetYearStart: "2035-01-01T00:00:00.000Z",
    budgetYearEnd: "2035-12-31T23:59:59.999Z",
    countryBudgetTotal: 100,
    budgetItemName: "Mobile Transport",
    amount: 80,
    description: "Responsive review receipt",
    reviewStatus: ReviewStatus.PENDING_REVIEW,
  });

  await addAuditEntryFixture({
    actorEmail: adminEmail,
    action: AuditAction.RECEIPT_REVIEWED,
    entityType: "receipt",
    entityId: receipt.receiptId,
    details: { note: "mobile responsive smoke" },
  });

  await loginWithPassword(page, adminEmail, "AdminPass123");
  await expectOnDashboard(page);

  await page.goto(`${appBasePath}/review`);
  await expect(page.getByRole("heading", { name: "Review receipt" })).toBeVisible();

  await page.goto(`${appBasePath}/review/${receipt.receiptId}`);
  await expect(page.getByText(countryName)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();

  await page.goto(`${appBasePath}/audit-trail`);
  await expect(page.getByRole("heading", { name: "Audit Trail" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();

  await page.goto(`${appBasePath}/compliance`);
  await page.getByRole("combobox").nth(1).selectOption(receipt.budgetYearId);
  await expect(page.getByRole("heading", { name: "Compliance Dashboard" })).toBeVisible();
  await expect(page.getByText(countryName)).toBeVisible();
});
