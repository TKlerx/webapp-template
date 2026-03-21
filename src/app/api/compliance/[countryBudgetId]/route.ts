import { jsonError } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { getBudgetItemBreakdown } from "@/lib/compliance";
import { Role } from "../../../../../generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireCountryAccess } from "@/lib/rbac";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ countryBudgetId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return jsonError("Not authenticated", 401);
  }

  if (user.role !== Role.GVI_FINANCE_ADMIN && user.role !== Role.COUNTRY_ADMIN) {
    return jsonError("Not authorized", 403);
  }

  const { countryBudgetId } = await params;
  const countryBudget = await prisma.countryBudget.findUnique({
    where: { id: countryBudgetId },
    include: {
      country: true,
      budgetYear: true,
    },
  });
  if (!countryBudget) {
    return jsonError("Country budget not found", 404);
  }

  if (user.role === Role.COUNTRY_ADMIN) {
    try {
      await requireCountryAccess(user, countryBudget.countryId);
    } catch {
      return jsonError("Not authorized", 403);
    }
  }

  const url = new URL(request.url);
  const statusFilter = (url.searchParams.get("statusFilter") ?? "all") as "approved" | "all";
  const data = await getBudgetItemBreakdown(countryBudgetId, statusFilter);

  return Response.json({
    data,
    countryBudget: {
      id: countryBudget.id,
      countryId: countryBudget.countryId,
      countryName: countryBudget.country.name,
      budgetYearLabel: countryBudget.budgetYear.label,
      currency: countryBudget.currency,
    },
  });
}
