"use client";

import { Button } from "@/components/ui/Button";
import { withBasePath } from "@/lib/base-path";

type AuditExportButtonProps = {
  queryString: string;
};

export function AuditExportButton({ queryString }: AuditExportButtonProps) {
  return (
    <div className="flex gap-3">
      <a href={withBasePath(`/api/audit/export?format=csv&${queryString}`)}>
        <Button type="button">Export CSV</Button>
      </a>
      <a href={withBasePath(`/api/audit/export?format=pdf&${queryString}`)}>
        <Button type="button" variant="secondary">Export PDF</Button>
      </a>
    </div>
  );
}
