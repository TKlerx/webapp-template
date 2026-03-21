import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ComplianceDashboard } from "@/components/compliance/ComplianceDashboard";
import { Role } from "../../../../generated/prisma/enums";

export default async function CompliancePage() {
  const user = await requireSession();
  const t = await getTranslations("compliance");

  if (user.role !== Role.GVI_FINANCE_ADMIN && user.role !== Role.COUNTRY_ADMIN) {
    return <p className="text-sm opacity-70">Not authorized.</p>;
  }

  const budgetYears = await prisma.budgetYear.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, label: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] opacity-45">{t("title")}</p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-4xl">{t("title")}</h1>
      </div>
      <ComplianceDashboard budgetYears={budgetYears} />
    </div>
  );
}
