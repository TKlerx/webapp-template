import { expect, test } from "@playwright/test";
import { ReviewStatus, Role } from "../../generated/prisma/enums";
import { appBasePath, expectOnDashboard, loginWithPassword } from "./helpers/auth";
import {
  addReviewCommentFixture,
  seedLocalUser,
  seedReceiptFixture,
} from "./helpers/db";

test("country finance responds to flagged receipts with comment and revision", async ({ page }) => {
  const runId = Date.now().toString(36);
  const adminEmail = `e2e-flag-admin-${runId}@example.com`;
  const financeEmail = `e2e-flag-finance-${runId}@example.com`;
  const countryName = `Kenya Flag ${runId}`;

  await seedLocalUser({
    email: adminEmail,
    name: "Flag Admin",
    role: Role.GVI_FINANCE_ADMIN,
    password: "AdminPass123",
    mustChangePassword: false,
  });
  await seedLocalUser({
    email: financeEmail,
    name: "Flag Finance",
    role: Role.COUNTRY_FINANCE,
    password: "FinancePass123",
    mustChangePassword: false,
  });

  const commentReceipt = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `KE-FLAG-${runId}`,
    countryName: countryName,
    budgetYearLabel: `2026 Flag Workflow ${runId}`,
    budgetItemName: "Flagged Comment Item",
    amount: 75,
    description: "Needs clarification",
    reviewStatus: ReviewStatus.FLAGGED,
  });
  await addReviewCommentFixture({
    receiptId: commentReceipt.receiptId,
    authorEmail: adminEmail,
    text: "Please explain this receipt",
  });

  const revisionReceipt = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `KE-FLAG-${runId}`,
    countryName: countryName,
    budgetYearLabel: `2026 Flag Workflow ${runId}`,
    budgetItemName: "Flagged Revision Item",
    amount: 90,
    description: "Needs corrected file",
    reviewStatus: ReviewStatus.FLAGGED,
  });
  await addReviewCommentFixture({
    receiptId: revisionReceipt.receiptId,
    authorEmail: adminEmail,
    text: "Please upload the corrected receipt",
  });

  await loginWithPassword(page, financeEmail, "FinancePass123");
  await expectOnDashboard(page);

  await page.goto(`${appBasePath}/review/${commentReceipt.receiptId}`);
  await expect(page.getByText("Please explain this receipt")).toBeVisible();
  await page.getByPlaceholder("Write a comment").fill("Here is the clarification.");
  await page.getByRole("button", { name: "Add comment" }).click();
  await expect(page.getByText("Here is the clarification.")).toBeVisible();
  await expect(page.getByText("PENDING REVIEW")).toBeVisible();

  await page.goto(`${appBasePath}/review/${revisionReceipt.receiptId}`);
  await page.setInputFiles('input[type="file"]', {
    name: "corrected.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 corrected"),
  });
  await expect(page.getByText("corrected.pdf")).toBeVisible();
  await expect(page.getByText("PENDING REVIEW")).toBeVisible();
});
