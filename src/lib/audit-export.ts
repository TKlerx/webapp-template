import { prisma } from "@/lib/db";
import { buildAuditFilters } from "@/services/api/audit-filters";
import type { AuditFilters } from "@/services/api/types";
import { AuditAction } from "../../generated/prisma/enums";

export async function getAuditEntries(filters: AuditFilters = {}) {
  const where = buildAuditFilters(filters);

  const [total, entries] = await Promise.all([
    prisma.auditEntry.count({ where }),
    prisma.auditEntry.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        scope: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      ...(filters.page && filters.limit
        ? {
            skip: (filters.page - 1) * filters.limit,
            take: filters.limit,
          }
        : {}),
    }),
  ]);

  return { total, entries };
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

export async function exportToCSV(filters: AuditFilters = {}) {
  const { entries } = await getAuditEntries(filters);
  const lines = [
    [
      "Date",
      "Action",
      "Entity Type",
      "Entity ID",
      "Actor",
      "Actor Email",
      "Scope",
      "Details",
    ].join(","),
    ...entries.map((entry) =>
      [
        csvEscape(entry.createdAt.toISOString()),
        csvEscape(entry.action),
        csvEscape(entry.entityType),
        csvEscape(entry.entityId),
        csvEscape(entry.actor.name),
        csvEscape(entry.actor.email),
        csvEscape(entry.scope?.name ?? ""),
        csvEscape(entry.details),
      ].join(","),
    ),
  ];

  return Buffer.from(lines.join("\n"), "utf8");
}

function escapePdfText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export async function exportToPDF(filters: AuditFilters = {}) {
  const { entries } = await getAuditEntries(filters);
  const lines = [
    "Audit Trail Export",
    "",
    ...entries.flatMap((entry) => [
      `${entry.createdAt.toISOString()} | ${entry.action} | ${entry.entityType} ${entry.entityId}`,
      `Actor: ${entry.actor.name} <${entry.actor.email}>`,
      `Scope: ${entry.scope?.name ?? "-"}`,
      `Details: ${entry.details}`,
      "",
    ]),
  ];

  const stream = lines
    .map((line, index) => `BT /F1 10 Tf 40 ${780 - index * 14} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");
  const content = Buffer.from(stream, "utf8");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${content.length} >> stream\n${stream}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
