import { ReceiptReviewDetail } from "@/components/review/ReceiptReviewDetail";
import { requireSession } from "@/lib/auth";
import { assertReceiptAccess, canRespondToFlaggedReceipt } from "@/lib/receipts";
import { Role } from "../../../../../generated/prisma/enums";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ receiptId: string }>;
}) {
  const user = await requireSession();
  const { receiptId } = await params;
  const receipt = await assertReceiptAccess(user, receiptId);

  const mode =
    user.role === Role.GVI_FINANCE_ADMIN
      ? "review"
      : canRespondToFlaggedReceipt(user, receipt)
        ? "respond"
        : "readonly";

  return (
    <ReceiptReviewDetail
      mode={mode}
      receipt={{
        ...receipt,
        amount: Number(receipt.amount),
      }}
    />
  );
}
