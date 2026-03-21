import { jsonError } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { assertReceiptAccess, canRespondToFlaggedReceipt, isValidReceiptMimeType, MAX_RECEIPT_FILE_SIZE } from "@/lib/receipts";
import { saveFile } from "@/lib/file-storage";
import { prisma } from "@/lib/db";
import { AuditAction, ReviewStatus } from "../../../../../../generated/prisma/enums";
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
      data: receipt.revisions.map((revision) => ({
        id: revision.id,
        fileName: revision.fileName,
        filePath: revision.filePath,
        fileSize: revision.fileSize,
        mimeType: revision.mimeType,
        createdAt: revision.createdAt,
        uploadedBy: revision.uploadedBy,
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

  try {
    const { id } = await params;
    const receipt = await assertReceiptAccess(user, id);
    if (!canRespondToFlaggedReceipt(user, receipt)) {
      return jsonError("Only the original submitter can revise a flagged receipt", 403);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("A file is required", 400);
    }

    if (!isValidReceiptMimeType(file.type)) {
      return jsonError("Unsupported file type", 400);
    }

    if (file.size > MAX_RECEIPT_FILE_SIZE) {
      return jsonError("File exceeds the 20 MB limit", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = await saveFile(buffer, file.name);

    const revision = await prisma.$transaction(async (tx) => {
      const created = await tx.receiptRevision.create({
        data: {
          receiptId: receipt.id,
          uploadedById: user.id,
          fileName: file.name,
          filePath,
          fileSize: file.size,
          mimeType: file.type,
        },
        include: {
          uploadedBy: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      await tx.receipt.update({
        where: { id: receipt.id },
        data: { reviewStatus: ReviewStatus.PENDING_REVIEW },
      });

      return created;
    });

    await logAudit({
      action: AuditAction.RECEIPT_REVISED,
      entityType: "receipt",
      entityId: receipt.id,
      actorId: user.id,
      countryId: receipt.budgetItem.countryBudget.countryId,
      details: {
        revisionId: revision.id,
        fileName: revision.fileName,
      },
    });

    return Response.json({ data: revision }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Receipt not found", 404);
    }
    return jsonError("Not authorized", 403);
  }
}
