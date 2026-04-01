import { jsonError } from "@/lib/http";
import { requireApiUserWithRoles } from "@/lib/route-auth";
import { exportToCSV, exportToPDF } from "@/lib/audit-export";
import { parseAuditExportRequest } from "@/services/api/audit-filters";
import { Role } from "../../../../../generated/prisma/enums";

export async function GET(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN]);
  if ("error" in auth) {
    return auth.error;
  }

  const parsedRequest = parseAuditExportRequest(request);
  if ("error" in parsedRequest) {
    return parsedRequest.error;
  }

  if (parsedRequest.format === "csv") {
    const buffer = await exportToCSV(parsedRequest.filters);
    return new Response(buffer, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="audit-trail.csv"',
      },
    });
  }

  if (parsedRequest.format === "pdf") {
    const buffer = await exportToPDF(parsedRequest.filters);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="audit-trail.pdf"',
      },
    });
  }

  return jsonError("Unsupported export format", 400);
}
