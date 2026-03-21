import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Role, ReviewStatus } from "../../../../generated/prisma/enums";
import { CountryReviewSummary } from "@/components/review/CountryReviewSummary";

export default async function DashboardPage() {
  const user = await requireSession();
  const t = await getTranslations("dashboard");

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  let countrySummary: {
    countryName: string;
    pending: number;
    approved: number;
    flagged: number;
    rejected: number;
  } | null = null;

  if (user.role === Role.COUNTRY_ADMIN) {
    const assignment = await prisma.userCountryAssignment.findFirst({
      where: { userId: user.id },
      include: { country: true },
    });

    if (assignment) {
      const receipts = await prisma.receipt.findMany({
        where: {
          budgetItem: {
            countryBudget: {
              countryId: assignment.countryId,
            },
          },
        },
        select: { reviewStatus: true },
      });

      countrySummary = {
        countryName: assignment.country.name,
        pending: receipts.filter((receipt) => receipt.reviewStatus === ReviewStatus.PENDING_REVIEW).length,
        approved: receipts.filter((receipt) => receipt.reviewStatus === ReviewStatus.APPROVED).length,
        flagged: receipts.filter((receipt) => receipt.reviewStatus === ReviewStatus.FLAGGED).length,
        rejected: receipts.filter((receipt) => receipt.reviewStatus === ReviewStatus.REJECTED).length,
      };
    }
  }

  return (
    <div>
      <p className="text-sm uppercase tracking-[0.2em] opacity-45">{t("label")}</p>
      <h1 className="mt-3 text-2xl font-semibold sm:text-4xl">
        {t("welcomeBack", { name: user.name })}
      </h1>

      <section className="mt-8 grid gap-4 sm:mt-10 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-black/10 bg-[var(--panel)] p-5 sm:p-6 dark:border-white/10">
          <p className="text-sm uppercase tracking-[0.2em] opacity-45">{t("role")}</p>
          <p className="mt-3 text-xl font-semibold sm:mt-4 sm:text-2xl">{user.role}</p>
        </article>
        <article className="rounded-2xl border border-black/10 bg-[var(--panel)] p-5 sm:p-6 dark:border-white/10">
          <p className="text-sm uppercase tracking-[0.2em] opacity-45">{t("status")}</p>
          <p className="mt-3 text-xl font-semibold sm:mt-4 sm:text-2xl">{user.status}</p>
        </article>
        <article className="rounded-2xl border border-black/10 bg-[var(--panel)] p-5 sm:p-6 dark:border-white/10">
          <p className="text-sm uppercase tracking-[0.2em] opacity-45">{t("theme")}</p>
          <p className="mt-3 text-xl font-semibold sm:mt-4 sm:text-2xl">{user.themePreference}</p>
        </article>
      </section>

      {countrySummary ? (
        <div className="mt-8">
          <CountryReviewSummary summary={countrySummary} />
        </div>
      ) : null}
    </div>
  );
}
