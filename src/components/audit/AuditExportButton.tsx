"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { withBasePath } from "@/lib/base-path";

type AuditExportButtonProps = {
  queryString: string;
};

export function AuditExportButton({ queryString }: AuditExportButtonProps) {
  const t = useTranslations("audit");
  const suffix = queryString ? `&${queryString}` : "";

  return (
    <div className="flex flex-wrap gap-2">
      <a href={withBasePath(`/api/audit/export?format=csv${suffix}`)}>
        <Button type="button">{t("exportCsv")}</Button>
      </a>
      <a href={withBasePath(`/api/audit/export?format=pdf${suffix}`)}>
        <Button type="button" variant="secondary">
          {t("exportPdf")}
        </Button>
      </a>
    </div>
  );
}
