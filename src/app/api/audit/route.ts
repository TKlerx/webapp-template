import { jsonError } from "@/lib/http";
import { requireApiUserWithRoles } from "@/lib/route-auth";
import { getAuditEntries } from "@/lib/audit-export";
import { AuditAction, Role } from "../../../../generated/prisma/enums";

export async function GET(request: Request) {
  const auth = await requireApiUserWithRoles([Role.GVI_FINANCE_ADMIN]);
  if ("error" in auth) {
    return auth.error;
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "25");
  const action = url.searchParams.get("action") as AuditAction | null;
  const entityType = url.searchParams.get("entityType");
  const countryId = url.searchParams.get("countryId");
  const actorId = url.searchParams.get("actorId");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  if (action && !Object.values(AuditAction).includes(action)) {
    return jsonError("Invalid audit action", 400);
  }

  const result = await getAuditEntries({
    action,
    entityType,
    countryId,
    actorId,
    dateFrom: dateFrom ? new Date(dateFrom) : null,
    dateTo: dateTo ? new Date(dateTo) : null,
    page,
    limit,
  });

  return Response.json({
    data: result.entries,
    total: result.total,
    page,
    limit,
  });
}
