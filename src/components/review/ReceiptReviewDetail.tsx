import { getTranslations } from "next-intl/server";
import { FileRevisionViewer } from "@/components/review/FileRevisionViewer";
import { CommentThread } from "@/components/review/CommentThread";
import { ReviewActions } from "@/components/review/ReviewActions";
import { StatusBadge } from "@/components/ui/StatusBadge";

type ReceiptReviewDetailProps = {
  receipt: {
    id: string;
    amount: number;
    currency: string;
    date: Date;
    description: string;
    fileName: string;
    mimeType: string;
    reviewStatus: "PENDING_REVIEW" | "APPROVED" | "FLAGGED" | "REJECTED";
    budgetItem: {
      name: string;
      countryBudget: {
        country: {
          name: string;
        };
      };
    };
    uploadedBy: {
      id: string;
      name: string;
      email: string;
    };
    reviewComments: Array<{
      id: string;
      text: string;
      createdAt: Date;
      author: {
        name: string;
        role: string;
      };
    }>;
    revisions: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      createdAt: Date;
      uploadedBy: {
        name: string;
        role: string;
      };
    }>;
  };
  mode: "review" | "respond" | "readonly";
};

export async function ReceiptReviewDetail({ receipt, mode }: ReceiptReviewDetailProps) {
  const t = await getTranslations("review");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
      <div className="space-y-6">
        <FileRevisionViewer
          original={{ fileName: receipt.fileName, mimeType: receipt.mimeType }}
          receiptId={receipt.id}
          revisions={receipt.revisions}
        />
      </div>
      <div className="space-y-6">
        <section className="rounded-2xl border border-black/10 bg-[var(--panel)] p-5 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">{t("reviewReceipt")}</h1>
            <StatusBadge status={receipt.reviewStatus} />
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="opacity-55">{t("submitter")}</dt>
              <dd>{receipt.uploadedBy.name} ({receipt.uploadedBy.email})</dd>
            </div>
            <div>
              <dt className="opacity-55">{t("budgetItem")}</dt>
              <dd>{receipt.budgetItem.countryBudget.country.name} - {receipt.budgetItem.name}</dd>
            </div>
            <div>
              <dt className="opacity-55">{t("title")}</dt>
              <dd>{receipt.amount} {receipt.currency} - {receipt.date.toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="opacity-55">Description</dt>
              <dd>{receipt.description}</dd>
            </div>
          </dl>
        </section>

        <ReviewActions mode={mode} receiptId={receipt.id} />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t("comments")}</h2>
          <CommentThread comments={receipt.reviewComments} />
        </section>
      </div>
    </div>
  );
}
