import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReviewStatus } from "../../../generated/prisma/enums";

export function CountryReviewSummary({
  summary,
}: {
  summary: {
    countryName: string;
    pending: number;
    approved: number;
    flagged: number;
    rejected: number;
  };
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-[var(--panel)] p-5 dark:border-white/10">
      <h2 className="text-xl font-semibold">{summary.countryName}</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        <StatusBadge label={`Pending ${summary.pending}`} status={ReviewStatus.PENDING_REVIEW} />
        <StatusBadge label={`Approved ${summary.approved}`} status={ReviewStatus.APPROVED} />
        <StatusBadge label={`Flagged ${summary.flagged}`} status={ReviewStatus.FLAGGED} />
        <StatusBadge label={`Rejected ${summary.rejected}`} status={ReviewStatus.REJECTED} />
      </div>
    </section>
  );
}
