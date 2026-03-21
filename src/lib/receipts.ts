import { prisma } from "@/lib/db";
import { requireCountryAccess } from "@/lib/rbac";
import type { SessionUser } from "@/lib/auth";
import { Role, ReviewStatus } from "../../generated/prisma/enums";

export const MAX_RECEIPT_FILE_SIZE = 20 * 1024 * 1024;
export const ALLOWED_RECEIPT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export function isValidReceiptMimeType(mimeType: string) {
  return ALLOWED_RECEIPT_MIME_TYPES.includes(mimeType);
}

export async function getReceiptForAccess(receiptId: string) {
  return prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      budgetItem: {
        include: {
          countryBudget: {
            include: {
              country: true,
              budgetYear: true,
            },
          },
        },
      },
      reviewComments: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      revisions: {
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function assertReceiptAccess(user: SessionUser, receiptId: string) {
  const receipt = await getReceiptForAccess(receiptId);
  if (!receipt) {
    throw new Error("NOT_FOUND");
  }

  if (user.role === Role.GVI_FINANCE_ADMIN) {
    return receipt;
  }

  await requireCountryAccess(user, receipt.budgetItem.countryBudget.countryId);

  if (user.role === Role.COUNTRY_FINANCE && receipt.uploadedById !== user.id) {
    throw new Error("FORBIDDEN");
  }

  return receipt;
}

export function canRespondToFlaggedReceipt(user: SessionUser, receipt: { uploadedById: string; reviewStatus: ReviewStatus }) {
  return (
    user.role === Role.COUNTRY_FINANCE &&
    receipt.uploadedById === user.id &&
    receipt.reviewStatus === ReviewStatus.FLAGGED
  );
}
