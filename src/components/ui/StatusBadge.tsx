import { clsx } from "clsx";
import { ReviewStatus } from "../../../generated/prisma/enums";

const badgeStyles: Record<ReviewStatus, string> = {
  [ReviewStatus.PENDING_REVIEW]:
    "border-yellow-200 bg-yellow-100 text-yellow-900 dark:border-yellow-700/60 dark:bg-yellow-500/15 dark:text-yellow-200",
  [ReviewStatus.APPROVED]:
    "border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-500/15 dark:text-emerald-200",
  [ReviewStatus.FLAGGED]:
    "border-orange-200 bg-orange-100 text-orange-900 dark:border-orange-700/60 dark:bg-orange-500/15 dark:text-orange-200",
  [ReviewStatus.REJECTED]:
    "border-red-200 bg-red-100 text-red-900 dark:border-red-700/60 dark:bg-red-500/15 dark:text-red-200",
};

type StatusBadgeProps = {
  status: ReviewStatus;
  label?: string;
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        badgeStyles[status],
      )}
    >
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}
