import { jsonError } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { getCountrySummaries } from "@/lib/compliance";
import { Role } from "../../../../generated/prisma/enums";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return jsonError("Not authenticated", 401);
  }

  if (user.role !== Role.GVI_FINANCE_ADMIN && user.role !== Role.COUNTRY_ADMIN) {
    return jsonError("Not authorized", 403);
  }

  const url = new URL(request.url);
  const budgetYearId =
    url.searchParams.get("budgetYearId") ??
    (await prisma.budgetYear.findFirst({ orderBy: { startDate: "desc" } }))?.id;
  const statusFilter = (url.searchParams.get("statusFilter") ?? "all") as "approved" | "all";

  if (!budgetYearId) {
    return Response.json({ data: [] });
  }

  let summaries = await getCountrySummaries(budgetYearId, statusFilter);

  if (user.role === Role.COUNTRY_ADMIN) {
    const allowedCountryIds = await prisma.userCountryAssignment.findMany({
      where: { userId: user.id },
      select: { countryId: true },
    });
    const allowedSet = new Set(allowedCountryIds.map((item) => item.countryId));
    summaries = summaries.filter((summary) => allowedSet.has(summary.countryId));
  }

  return Response.json({ data: summaries });
}
