import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { ReviewStatus, Role } from "../../generated/prisma/enums";

const { logAudit, requireApiUserWithRoles } = vi.hoisted(() => ({
  logAudit: vi.fn(),
  requireApiUserWithRoles: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/audit", () => ({
  logAudit,
}));

vi.mock("@/lib/route-auth", () => ({
  requireApiUserWithRoles,
}));

import { applyReviewAction, validateTransition } from "@/lib/review";
import { POST } from "@/app/api/receipts/[id]/review/route";

describe("review state machine", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("allows the documented admin transitions", () => {
    expect(validateTransition(ReviewStatus.PENDING_REVIEW, ReviewStatus.APPROVED, Role.GVI_FINANCE_ADMIN)).toEqual({ valid: true });
    expect(validateTransition(ReviewStatus.PENDING_REVIEW, ReviewStatus.FLAGGED, Role.GVI_FINANCE_ADMIN)).toEqual({ valid: true });
    expect(validateTransition(ReviewStatus.PENDING_REVIEW, ReviewStatus.REJECTED, Role.GVI_FINANCE_ADMIN)).toEqual({ valid: true });
    expect(validateTransition(ReviewStatus.APPROVED, ReviewStatus.FLAGGED, Role.GVI_FINANCE_ADMIN)).toEqual({ valid: true });
    expect(validateTransition(ReviewStatus.REJECTED, ReviewStatus.FLAGGED, Role.GVI_FINANCE_ADMIN)).toEqual({ valid: true });
  });

  it("rejects invalid transitions", () => {
    expect(validateTransition(ReviewStatus.APPROVED, ReviewStatus.REJECTED, Role.GVI_FINANCE_ADMIN)).toEqual({
      valid: false,
      error: "Review status transition is not allowed",
    });
    expect(validateTransition(ReviewStatus.PENDING_REVIEW, ReviewStatus.APPROVED, Role.COUNTRY_FINANCE)).toEqual({
      valid: false,
      error: "Review status transition is not allowed",
    });
  });

  it("creates a comment and audit entry for a flagged review action", async () => {
    prismaMock.receipt.findUnique.mockResolvedValue({
      id: "receipt-1",
      reviewStatus: ReviewStatus.PENDING_REVIEW,
      budgetItem: {
        countryBudget: {
          countryId: "country-1",
        },
      },
    } as never);
    prismaMock.$transaction.mockImplementation(((callback: (tx: {
      receipt: { update: ReturnType<typeof vi.fn> };
      reviewComment: { create: ReturnType<typeof vi.fn> };
    }) => Promise<unknown>) =>
      callback({
        receipt: {
          update: vi.fn().mockResolvedValue({
            id: "receipt-1",
            reviewStatus: ReviewStatus.FLAGGED,
          }),
        },
        reviewComment: {
          create: vi.fn().mockResolvedValue({
            id: "comment-1",
            text: "Needs clarification",
            createdAt: new Date("2026-03-21T00:00:00Z"),
          }),
        },
      })) as never);

    const result = await applyReviewAction({
      receiptId: "receipt-1",
      nextStatus: ReviewStatus.FLAGGED,
      userId: "admin-1",
      userRole: Role.GVI_FINANCE_ADMIN,
      comment: "Needs clarification",
    });

    expect("error" in result).toBe(false);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "RECEIPT_REVIEWED",
      entityId: "receipt-1",
    }));
  });
});

describe("review route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid review statuses", async () => {
    requireApiUserWithRoles.mockResolvedValue({
      user: { id: "admin-1", role: Role.GVI_FINANCE_ADMIN },
    });

    const response = await POST(
      new Request("http://localhost/api/receipts/receipt-1/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "UNKNOWN" }),
      }),
      { params: Promise.resolve({ id: "receipt-1" }) },
    );
    if (!response) {
      throw new Error("Expected response");
    }

    expect(response.status).toBe(400);
  });
});
