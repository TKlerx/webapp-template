import { expect, test } from "@playwright/test";
import { ReviewStatus, Role } from "../../generated/prisma/enums";
import { appBasePath, expectOnDashboard, loginWithPassword } from "./helpers/auth";
import {
  addReviewCommentFixture,
  assignUserToCountry,
  seedLocalUser,
  seedReceiptFixture,
} from "./helpers/db";

test("country admin sees country review summary and receipt detail in read-only mode", async ({ page }) => {
  const runId = Date.now().toString(36);
  const adminEmail = `e2e-country-admin-${runId}@example.com`;
  const financeEmail = `e2e-country-finance-${runId}@example.com`;
  const countryCode = `KE-CA-${runId}`;
  const countryName = `Kenya Country Admin ${runId}`;

  await seedLocalUser({
    email: adminEmail,
    name: "Country Admin User",
    role: Role.COUNTRY_ADMIN,
    password: "AdminPass123",
    mustChangePassword: false,
  });
  await seedLocalUser({
    email: financeEmail,
    name: "Country Finance User",
    role: Role.COUNTRY_FINANCE,
    password: "FinancePass123",
    mustChangePassword: false,
  });

  await assignUserToCountry(adminEmail, {
    code: countryCode,
    name: countryName,
  });
  await assignUserToCountry(financeEmail, {
    code: countryCode,
    name: countryName,
  });

  const receipt = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: countryCode,
    countryName: countryName,
    budgetYearLabel: `2026 Country Admin ${runId}`,
    budgetItemName: "Community Outreach",
    amount: 60,
    description: "Flagged receipt for readonly view",
    reviewStatus: ReviewStatus.FLAGGED,
  });

  await addReviewCommentFixture({
    receiptId: receipt.receiptId,
    authorEmail: adminEmail,
    text: "Visible reviewer note",
  });

  await loginWithPassword(page, adminEmail, "AdminPass123");
  await expectOnDashboard(page);
  await page.goto(`${appBasePath}/dashboard`);

  await expect(page.getByText(countryName)).toBeVisible();
  await expect(page.getByText("Flagged 1")).toBeVisible();

  await page.goto(`${appBasePath}/review/${receipt.receiptId}`);
  await expect(page.getByText("Visible reviewer note")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Flag" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject" })).toHaveCount(0);
});
