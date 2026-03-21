import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { AuthMethod, ReviewStatus, Role, ThemePreference, UserStatus } from "../../generated/prisma/enums";

const {
  getSessionUser,
  assertReceiptAccess,
  canRespondToFlaggedReceipt,
  isValidReceiptMimeType,
  saveFile,
  logAudit,
} = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  assertReceiptAccess: vi.fn(),
  canRespondToFlaggedReceipt: vi.fn(),
  isValidReceiptMimeType: vi.fn(),
  saveFile: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/receipts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/receipts")>("@/lib/receipts");
  return {
    ...actual,
    assertReceiptAccess,
    canRespondToFlaggedReceipt,
    isValidReceiptMimeType,
  };
});

vi.mock("@/lib/file-storage", () => ({
  saveFile,
}));

vi.mock("@/lib/audit", () => ({
  logAudit,
}));

import { POST as postComment } from "@/app/api/receipts/[id]/comments/route";
import { POST as postRevision } from "@/app/api/receipts/[id]/revisions/route";

const countryFinanceUser = {
  id: "user-1",
  email: "finance@example.com",
  name: "Country Finance",
  role: Role.COUNTRY_FINANCE,
  status: UserStatus.ACTIVE,
  authMethod: AuthMethod.LOCAL,
  themePreference: ThemePreference.LIGHT,
  mustChangePassword: false,
};

const flaggedReceipt = {
  id: "receipt-1",
  uploadedById: "user-1",
  reviewStatus: ReviewStatus.FLAGGED,
  budgetItem: {
    countryBudget: {
      countryId: "country-1",
    },
  },
};

describe("flag response routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reverts a flagged receipt to pending review when the owner comments", async () => {
    getSessionUser.mockResolvedValue(countryFinanceUser);
    assertReceiptAccess.mockResolvedValue(flaggedReceipt);
    canRespondToFlaggedReceipt.mockReturnValue(true);
    prismaMock.$transaction.mockImplementation(((callback: (tx: {
      reviewComment: { create: ReturnType<typeof vi.fn> };
      receipt: { update: ReturnType<typeof vi.fn> };
    }) => Promise<unknown>) =>
      callback({
        reviewComment: {
          create: vi.fn().mockResolvedValue({
            id: "comment-1",
            text: "Updated receipt explanation",
            author: {
              id: "user-1",
              name: "Country Finance",
              role: Role.COUNTRY_FINANCE,
            },
          }),
        },
        receipt: {
          update: vi.fn().mockResolvedValue({
            id: "receipt-1",
            reviewStatus: ReviewStatus.PENDING_REVIEW,
          }),
        },
      })) as never);

    const response = await postComment(
      new Request("http://localhost/api/receipts/receipt-1/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Updated receipt explanation" }),
      }),
      { params: Promise.resolve({ id: "receipt-1" }) },
    );

    if (!response) {
      throw new Error("Expected response");
    }

    expect(response.status).toBe(201);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "RECEIPT_COMMENTED",
      entityId: "receipt-1",
      details: expect.objectContaining({
        previousStatus: ReviewStatus.FLAGGED,
        nextStatus: ReviewStatus.PENDING_REVIEW,
      }),
    }));
  });

  it("rejects revision uploads with unsupported file types", async () => {
    getSessionUser.mockResolvedValue(countryFinanceUser);
    assertReceiptAccess.mockResolvedValue(flaggedReceipt);
    canRespondToFlaggedReceipt.mockReturnValue(true);
    isValidReceiptMimeType.mockReturnValue(false);

    const formData = new FormData();
    formData.set("file", new File(["oops"], "receipt.txt", { type: "text/plain" }));

    const response = await postRevision(
      new Request("http://localhost/api/receipts/receipt-1/revisions", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ id: "receipt-1" }) },
    );

    if (!response) {
      throw new Error("Expected response");
    }

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Unsupported file type" });
  });

  it("rejects revision uploads from non-owners", async () => {
    getSessionUser.mockResolvedValue(countryFinanceUser);
    assertReceiptAccess.mockResolvedValue(flaggedReceipt);
    canRespondToFlaggedReceipt.mockReturnValue(false);

    const formData = new FormData();
    formData.set("file", new File(["pdf"], "receipt.pdf", { type: "application/pdf" }));

    const response = await postRevision(
      new Request("http://localhost/api/receipts/receipt-1/revisions", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ id: "receipt-1" }) },
    );

    if (!response) {
      throw new Error("Expected response");
    }

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only the original submitter can revise a flagged receipt",
    });
  });

  it("stores a valid revision and logs the audit entry", async () => {
    getSessionUser.mockResolvedValue(countryFinanceUser);
    assertReceiptAccess.mockResolvedValue(flaggedReceipt);
    canRespondToFlaggedReceipt.mockReturnValue(true);
    isValidReceiptMimeType.mockReturnValue(true);
    saveFile.mockResolvedValue("uploads/2026/03/revision.pdf");
    prismaMock.$transaction.mockImplementation(((callback: (tx: {
      receiptRevision: { create: ReturnType<typeof vi.fn> };
      receipt: { update: ReturnType<typeof vi.fn> };
    }) => Promise<unknown>) =>
      callback({
        receiptRevision: {
          create: vi.fn().mockResolvedValue({
            id: "revision-1",
            fileName: "receipt.pdf",
            filePath: "uploads/2026/03/revision.pdf",
            fileSize: 3,
            mimeType: "application/pdf",
            uploadedBy: {
              id: "user-1",
              name: "Country Finance",
              role: Role.COUNTRY_FINANCE,
            },
          }),
        },
        receipt: {
          update: vi.fn().mockResolvedValue({
            id: "receipt-1",
            reviewStatus: ReviewStatus.PENDING_REVIEW,
          }),
        },
      })) as never);

    const formData = new FormData();
    formData.set("file", new File(["pdf"], "receipt.pdf", { type: "application/pdf" }));

    const response = await postRevision(
      new Request("http://localhost/api/receipts/receipt-1/revisions", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ id: "receipt-1" }) },
    );

    if (!response) {
      throw new Error("Expected response");
    }

    expect(response.status).toBe(201);
    expect(saveFile).toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "RECEIPT_REVISED",
      entityId: "receipt-1",
    }));
  });
});
