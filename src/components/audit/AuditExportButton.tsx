"use client";

import { Button } from "@mantine/core";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/base-path";
import { useToast } from "@/components/ui/Toast";

type AuditExportButtonProps = {
  queryString: string;
};

const exportButtonClassName =
  "min-h-10 rounded-lg px-4 text-sm font-semibold focus-visible:outline-ring aria-disabled:cursor-wait aria-disabled:opacity-55";

export function AuditExportButton({ queryString }: AuditExportButtonProps) {
  const t = useTranslations("audit");
  const common = useTranslations("common");
  const { pushToast } = useToast();
  const [busyFormat, setBusyFormat] = useState<"csv" | "pdf" | null>(null);
  const suffix = queryString ? `&${queryString}` : "";

  async function handleExport(format: "csv" | "pdf") {
    if (busyFormat) return;
    setBusyFormat(format);
    try {
      const response = await fetch(
        withBasePath(`/api/audit/export?format=${format}${suffix}`),
      );
      if (!response.ok) {
        pushToast(common("error"));
        return;
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = format === "csv" ? "audit-trail.csv" : "audit-trail.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);

      if (response.headers.get("X-Audit-Export-Truncated") === "1") {
        const count = response.headers.get("X-Audit-Export-Count") ?? "0";
        pushToast(t("exportTruncated", { count }));
      }
    } catch {
      pushToast(common("error"));
    } finally {
      setBusyFormat(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        aria-busy={busyFormat === "csv"}
        aria-disabled={busyFormat !== null}
        className={`${exportButtonClassName} bg-accent text-accent-foreground hover:bg-accent/90`}
        onClick={() => void handleExport("csv")}
      >
        {t("exportCsv")}
      </Button>
      <Button
        type="button"
        variant="default"
        aria-busy={busyFormat === "pdf"}
        aria-disabled={busyFormat !== null}
        className={`${exportButtonClassName} border-border bg-panel text-foreground hover:bg-secondary`}
        onClick={() => void handleExport("pdf")}
      >
        {t("exportPdf")}
      </Button>
    </div>
  );
}
