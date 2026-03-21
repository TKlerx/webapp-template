import { expect, test } from "@playwright/test";
import { ReviewStatus, Role } from "../../generated/prisma/enums";
import { appBasePath, expectOnDashboard, loginWithPassword } from "./helpers/auth";
import { addReviewCommentFixture, seedLocalUser, seedReceiptFixture } from "./helpers/db";

test("review flows show success and error toasts for actions, comments, and revisions", async ({ page }) => {
  const runId = Date.now().toString(36);
  const adminEmail = `e2e-toast-admin-${runId}@example.com`;
  const financeEmail = `e2e-toast-finance-${runId}@example.com`;
  const countryName = `Toast Country ${runId}`;
  const budgetYearLabel = `2026 Toast Workflow ${runId}`;

  await seedLocalUser({
    email: adminEmail,
    name: "Toast Admin",
    role: Role.GVI_FINANCE_ADMIN,
    password: "AdminPass123",
    mustChangePassword: false,
  });
  await seedLocalUser({
    email: financeEmail,
    name: "Toast Finance",
    role: Role.COUNTRY_FINANCE,
    password: "FinancePass123",
    mustChangePassword: false,
  });

  const approveReceipt = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `KE-TOAST-${runId}`,
    countryName,
    budgetYearLabel,
    budgetItemName: "Approve Item",
    amount: 100,
    description: "Approve me",
  });
  const flagErrorReceipt = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `KE-TOAST-${runId}`,
    countryName,
    budgetYearLabel,
    budgetItemName: "Flag Error Item",
    amount: 110,
    description: "Flag without comment",
  });
  const flagReceipt = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `KE-TOAST-${runId}`,
    countryName,
    budgetYearLabel,
    budgetItemName: "Flag Item",
    amount: 120,
    description: "Flag with comment",
  });
  const rejectReceipt = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `KE-TOAST-${runId}`,
    countryName,
    budgetYearLabel,
    budgetItemName: "Reject Item",
    amount: 130,
    description: "Reject with comment",
  });
  const commentErrorReceipt = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `KE-TOAST-${runId}`,
    countryName,
    budgetYearLabel,
    budgetItemName: "Comment Error Item",
    amount: 140,
    description: "Empty response",
    reviewStatus: ReviewStatus.FLAGGED,
  });
  await addReviewCommentFixture({
    receiptId: commentErrorReceipt.receiptId,
    authorEmail: adminEmail,
    text: "Please clarify this expense",
  });
  const commentSuccessReceipt = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `KE-TOAST-${runId}`,
    countryName,
    budgetYearLabel,
    budgetItemName: "Comment Success Item",
    amount: 150,
    description: "Clarification needed",
    reviewStatus: ReviewStatus.FLAGGED,
  });
  await addReviewCommentFixture({
    receiptId: commentSuccessReceipt.receiptId,
    authorEmail: adminEmail,
    text: "Please add the missing vendor details",
  });
  const revisionErrorReceipt = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `KE-TOAST-${runId}`,
    countryName,
    budgetYearLabel,
    budgetItemName: "Revision Error Item",
    amount: 160,
    description: "Wrong file type",
    reviewStatus: ReviewStatus.FLAGGED,
  });
  await addReviewCommentFixture({
    receiptId: revisionErrorReceipt.receiptId,
    authorEmail: adminEmail,
    text: "Please upload the corrected receipt file",
  });
  const revisionSuccessReceipt = await seedReceiptFixture({
    uploadedByEmail: financeEmail,
    countryCode: `KE-TOAST-${runId}`,
    countryName,
    budgetYearLabel,
    budgetItemName: "Revision Success Item",
    amount: 170,
    description: "Correct file needed",
    reviewStatus: ReviewStatus.FLAGGED,
  });
  await addReviewCommentFixture({
    receiptId: revisionSuccessReceipt.receiptId,
    authorEmail: adminEmail,
    text: "Please upload the corrected PDF",
  });

  await loginWithPassword(page, adminEmail, "AdminPass123");
  await expectOnDashboard(page);

  await page.goto(`${appBasePath}/review/${approveReceipt.receiptId}`);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Review saved")).toBeVisible();
  await expect(page.getByText("APPROVED")).toBeVisible();

  await page.goto(`${appBasePath}/review/${flagErrorReceipt.receiptId}`);
  await page.getByRole("button", { name: "Flag" }).click();
  await expect(page.getByText("A comment is required for this review action")).toBeVisible();

  await page.goto(`${appBasePath}/review/${flagReceipt.receiptId}`);
  await page.getByPlaceholder("Write a comment").fill("Need clearer receipt details");
  await page.getByRole("button", { name: "Flag" }).click();
  await expect(page.getByText("Review saved")).toBeVisible();
  await expect(page.getByText("FLAGGED")).toBeVisible();

  await page.goto(`${appBasePath}/review/${rejectReceipt.receiptId}`);
  await page.getByPlaceholder("Write a comment").fill("This receipt is not eligible");
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Review saved")).toBeVisible();
  await expect(page.getByText("REJECTED")).toBeVisible();

  await loginWithPassword(page, financeEmail, "FinancePass123");
  await expectOnDashboard(page);

  await page.goto(`${appBasePath}/review/${commentErrorReceipt.receiptId}`);
  await page.getByRole("button", { name: "Add comment" }).click();
  await expect(page.getByText("Comment text is required")).toBeVisible();

  await page.goto(`${appBasePath}/review/${commentSuccessReceipt.receiptId}`);
  await page.getByPlaceholder("Write a comment").fill("Updated vendor context included.");
  await page.getByRole("button", { name: "Add comment" }).click();
  await expect(page.getByText("Response saved")).toBeVisible();
  await expect(page.getByText("PENDING REVIEW")).toBeVisible();

  await page.goto(`${appBasePath}/review/${revisionErrorReceipt.receiptId}`);
  await page.setInputFiles('input[type="file"]', {
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a supported receipt format"),
  });
  await expect(page.getByText("Unsupported file type")).toBeVisible();

  await page.goto(`${appBasePath}/review/${revisionSuccessReceipt.receiptId}`);
  await page.setInputFiles('input[type="file"]', {
    name: "corrected.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 corrected"),
  });
  await expect(page.getByText("Response saved")).toBeVisible();
  await expect(page.getByText("PENDING REVIEW")).toBeVisible();
  await expect(page.getByText("corrected.pdf")).toBeVisible();
});
