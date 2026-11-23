import PDFDocument from "pdfkit";
import path from "node:path";
import { prisma } from "@/lib/db";
import { buildAuditFilters } from "@/services/api/audit-filters";
import type { AuditFilters } from "@/services/api/types";
import { AuditAction } from "../../generated/prisma/enums";

const MAX_AUDIT_EXPORT_ROWS = 1000;
const CJK_RUN =
  /((?:\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}|\p{Script=Bopomofo}|[\u3000-\u303f])+)/u;

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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
  const text = neutralizeSpreadsheetFormula(String(value ?? ""));
  return `"${text.replaceAll('"', '""')}"`;
}

function neutralizeSpreadsheetFormula(value: string) {
  const trimmedLeading = value.trimStart();
  if (!trimmedLeading) {
    return value;
  }

  const first = trimmedLeading[0];
  if (first === "=" || first === "+" || first === "-" || first === "@") {
    return `'${value}`;
  }

  return value;
}

export async function exportToCSV(filters: AuditFilters = {}) {
  const { total, entries } = await getAuditEntries({
    ...filters,
    page: 1,
    limit: MAX_AUDIT_EXPORT_ROWS,
  });
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
        csvEscape(entry.actor?.name ?? "Anonymous"),
        csvEscape(entry.actor?.email ?? ""),
        csvEscape(entry.scope?.name ?? ""),
        csvEscape(entry.details),
      ].join(","),
    ),
  ];

  return {
    buffer: Buffer.from(lines.join("\n"), "utf8"),
    truncated: total > entries.length,
    total,
    exportedCount: entries.length,
  };
}

export async function exportToPDF(filters: AuditFilters = {}) {
  const { total, entries } = await getAuditEntries({
    ...filters,
    page: 1,
    limit: MAX_AUDIT_EXPORT_ROWS,
  });
  const lines = [
    "Audit Trail Export",
    "",
    ...entries.flatMap((entry) => [
      `${entry.createdAt.toISOString()} | ${entry.action} | ${entry.entityType} ${entry.entityId}`,
      `Actor: ${entry.actor ? `${entry.actor.name} <${entry.actor.email}>` : "Anonymous"}`,
      `Scope: ${entry.scope?.name ?? "-"}`,
      `Details: ${entry.details}`,
      "",
    ]),
  ];

  const buffer = await new Promise<Buffer<ArrayBuffer>>((resolve, reject) => {
    const defaultFont = path.join(
      process.cwd(),
      "public",
      "fonts",
      "DejaVuSans.ttf",
    );
    const cjkFont = path.join(
      process.cwd(),
      "public",
      "fonts",
      "NotoSansCJK-Regular.woff",
    );
    const pdf = new PDFDocument({
      pdfVersion: "1.4",
      size: "LETTER",
      margin: 44,
      font: defaultFont,
      info: { Title: "Audit Trail Export" },
    });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));

    pdf.fontSize(10);
    for (const line of lines) {
      const runs = line
        .split(CJK_RUN)
        .map((text, index) => ({
          text,
          font: index % 2 ? cjkFont : defaultFont,
        }))
        .filter(({ text }) => text.length > 0);
      if (runs.length === 0) pdf.moveDown(0.5);
      for (const [index, { text, font }] of runs.entries()) {
        pdf.font(font).text(text, { continued: index < runs.length - 1 });
      }
    }
    pdf.end();
  });

  return {
    buffer,
    truncated: total > entries.length,
    total,
    exportedCount: entries.length,
  };
}
