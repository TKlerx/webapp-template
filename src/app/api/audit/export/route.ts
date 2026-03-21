import { jsonError } from "@/lib/http";
import { requireApiUserWithRoles } from "@/lib/route-auth";
import { exportToCSV, exportToPDF } from "@/lib/audit-export";
import { AuditAction, Role } from "../../../../../generated/prisma/enums";

export async function GET(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN]);
  if ("error" in auth) {
    return auth.error;
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const action = url.searchParams.get("action") as AuditAction | null;
  const entityType = url.searchParams.get("entityType");
  const scopeId = url.searchParams.get("scopeId");
  const actorId = url.searchParams.get("actorId");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  const filters = {
    action,
    entityType,
    scopeId,
    actorId,
    dateFrom: dateFrom ? new Date(dateFrom) : null,
    dateTo: dateTo ? new Date(dateTo) : null,
  };

  if (format === "csv") {
    const buffer = await exportToCSV(filters);
    return new Response(buffer, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="audit-trail.csv"',
      },
    });
  }

  if (format === "pdf") {
    const buffer = await exportToPDF(filters);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="audit-trail.pdf"',
      },
    });
  }

  return jsonError("Unsupported export format", 400);
}
