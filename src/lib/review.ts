import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { logAudit } from "@/lib/audit";
import { Role, ReviewStatus, AuditAction } from "../../generated/prisma/enums";

const ADMIN_TRANSITIONS = new Set([
  `${ReviewStatus.PENDING_REVIEW}->${ReviewStatus.APPROVED}`,
  `${ReviewStatus.PENDING_REVIEW}->${ReviewStatus.FLAGGED}`,
  `${ReviewStatus.PENDING_REVIEW}->${ReviewStatus.REJECTED}`,
  `${ReviewStatus.APPROVED}->${ReviewStatus.FLAGGED}`,
  `${ReviewStatus.REJECTED}->${ReviewStatus.FLAGGED}`,
]);

const COUNTRY_FINANCE_TRANSITIONS = new Set([
  `${ReviewStatus.FLAGGED}->${ReviewStatus.PENDING_REVIEW}`,
]);

export function validateTransition(
  currentStatus: ReviewStatus,
  newStatus: ReviewStatus,
  userRole: Role,
) {
  if (currentStatus === newStatus) {
    return { valid: false, error: "Receipt is already in this review status" };
  }

  const key = `${currentStatus}->${newStatus}`;

  if (userRole === Role.GVI_FINANCE_ADMIN && ADMIN_TRANSITIONS.has(key)) {
    return { valid: true as const };
  }

  if (userRole === Role.COUNTRY_FINANCE && COUNTRY_FINANCE_TRANSITIONS.has(key)) {
    return { valid: true as const };
  }

  return { valid: false, error: "Review status transition is not allowed" };
}

type ApplyReviewActionInput = {
  receiptId: string;
  nextStatus: ReviewStatus;
  userId: string;
  userRole: Role;
  comment?: string | null;
};

export async function applyReviewAction(input: ApplyReviewActionInput) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: input.receiptId },
    include: {
      budgetItem: {
        select: {
          countryBudget: {
            select: {
              countryId: true,
            },
          },
        },
      },
    },
  });

  if (!receipt) {
    return { error: jsonError("Receipt not found", 404) };
  }

  const validation = validateTransition(receipt.reviewStatus, input.nextStatus, input.userRole);
  if (!validation.valid) {
    return { error: jsonError(validation.error, 400) };
  }

  const trimmedComment = input.comment?.trim() ?? "";
  if (
    (input.nextStatus === ReviewStatus.FLAGGED || input.nextStatus === ReviewStatus.REJECTED) &&
    !trimmedComment
  ) {
    return { error: jsonError("A comment is required for this review action", 400) };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedReceipt = await tx.receipt.update({
      where: { id: input.receiptId },
      data: { reviewStatus: input.nextStatus },
    });

    let createdComment: { id: string; text: string; createdAt: Date } | null = null;
    if (trimmedComment) {
      createdComment = await tx.reviewComment.create({
        data: {
          receiptId: input.receiptId,
          authorId: input.userId,
          text: trimmedComment,
        },
      });
    }

    return { updatedReceipt, createdComment };
  });

  await logAudit({
    action: AuditAction.RECEIPT_REVIEWED,
    entityType: "receipt",
    entityId: receipt.id,
    actorId: input.userId,
    countryId: receipt.budgetItem.countryBudget.countryId,
    details: {
      previousStatus: receipt.reviewStatus,
      nextStatus: input.nextStatus,
      comment: trimmedComment || null,
    },
  });

  return {
    receipt: result.updatedReceipt,
    comment: result.createdComment,
  };
}
