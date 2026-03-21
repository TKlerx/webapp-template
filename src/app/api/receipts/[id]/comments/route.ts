import { jsonError } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { assertReceiptAccess, canRespondToFlaggedReceipt } from "@/lib/receipts";
import { prisma } from "@/lib/db";
import { AuditAction, ReviewStatus, Role } from "../../../../../../generated/prisma/enums";
import { logAudit } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return jsonError("Not authenticated", 401);
  }

  try {
    const { id } = await params;
    const receipt = await assertReceiptAccess(user, id);
    return Response.json({
      data: receipt.reviewComments.map((comment) => ({
        id: comment.id,
        text: comment.text,
        createdAt: comment.createdAt,
        author: comment.author,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Receipt not found", 404);
    }
    return jsonError("Not authorized", 403);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return jsonError("Not authenticated", 401);
  }

  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim();
  if (!text) {
    return jsonError("Comment text is required", 400);
  }

  try {
    const { id } = await params;
    const receipt = await assertReceiptAccess(user, id);
    if (
      user.role === Role.COUNTRY_FINANCE &&
      !canRespondToFlaggedReceipt(user, receipt)
    ) {
      return jsonError("Flagged receipts can only be answered by the original submitter", 403);
    }

    const result = await prisma.$transaction(async (tx) => {
      const comment = await tx.reviewComment.create({
        data: {
          receiptId: receipt.id,
          authorId: user.id,
          text,
        },
        include: {
          author: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      let nextStatus = receipt.reviewStatus;
      if (user.role === Role.COUNTRY_FINANCE && receipt.reviewStatus === ReviewStatus.FLAGGED) {
        nextStatus = ReviewStatus.PENDING_REVIEW;
        await tx.receipt.update({
          where: { id: receipt.id },
          data: { reviewStatus: nextStatus },
        });
      }

      return { comment, nextStatus };
    });

    await logAudit({
      action: AuditAction.RECEIPT_COMMENTED,
      entityType: "receipt",
      entityId: receipt.id,
      actorId: user.id,
      countryId: receipt.budgetItem.countryBudget.countryId,
      details: {
        text,
        previousStatus: receipt.reviewStatus,
        nextStatus: result.nextStatus,
      },
    });

    return Response.json({ data: result.comment }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Receipt not found", 404);
    }
    return jsonError("Not authorized", 403);
  }
}
