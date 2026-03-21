import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth";
import { getBudgetItemBreakdown } from "@/lib/compliance";
import { prisma } from "@/lib/db";
import { requireCountryAccess } from "@/lib/rbac";
import { BudgetDrillDown } from "@/components/compliance/BudgetDrillDown";
import { Role } from "../../../../../generated/prisma/enums";

export default async function ComplianceDetailPage({
  params,
}: {
  params: Promise<{ countryBudgetId: string }>;
}) {
  const user = await requireSession();
  const t = await getTranslations("compliance");
  const { countryBudgetId } = await params;

  const countryBudget = await prisma.countryBudget.findUnique({
    where: { id: countryBudgetId },
    include: { country: true },
  });

  if (!countryBudget) {
    return <p className="text-sm opacity-70">Country budget not found.</p>;
  }

  if (user.role === Role.COUNTRY_ADMIN) {
    await requireCountryAccess(user, countryBudget.countryId);
  } else if (user.role !== Role.GVI_FINANCE_ADMIN) {
    return <p className="text-sm opacity-70">Not authorized.</p>;
  }

  const nodes = await getBudgetItemBreakdown(countryBudgetId, "all");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] opacity-45">{t("title")}</p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-4xl">{countryBudget.country.name}</h1>
      </div>
      <BudgetDrillDown countryBudgetId={countryBudgetId} nodes={nodes} />
    </div>
  );
}
