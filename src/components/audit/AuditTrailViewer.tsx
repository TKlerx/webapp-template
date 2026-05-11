"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/base-path";
import { AuditExportButton } from "@/components/audit/AuditExportButton";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
  actor: { name: string; email: string };
  scope?: { name: string } | null;
};

export function AuditTrailViewer() {
  const t = useTranslations("audit");
  const [filters, setFilters] = useState({
    action: "",
    entityType: "",
  });
  const [rows, setRows] = useState<AuditRow[]>([]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.action) params.set("action", filters.action);
    if (filters.entityType) params.set("entityType", filters.entityType);
    return params.toString();
  }, [filters]);

  useEffect(() => {
    void fetch(withBasePath(`/api/audit?${queryString}`))
      .then((response) => response.json())
      .then((payload: { data: AuditRow[] }) => setRows(payload.data ?? []));
  }, [queryString]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <input
          className="rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm dark:border-white/10"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              action: event.target.value,
            }))
          }
          placeholder={t("action")}
          value={filters.action}
        />
        <input
          className="rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm dark:border-white/10"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              entityType: event.target.value,
            }))
          }
          placeholder={t("entity")}
          value={filters.entityType}
        />
        <AuditExportButton queryString={queryString} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
        <table className="min-w-full bg-[var(--panel)] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/10">
              <th className="px-4 py-3">{t("date")}</th>
              <th className="px-4 py-3">{t("actor")}</th>
              <th className="px-4 py-3">{t("action")}</th>
              <th className="px-4 py-3">{t("entity")}</th>
              <th className="px-4 py-3">{t("scope")}</th>
              <th className="px-4 py-3">{t("details")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-black/5 dark:border-white/5"
              >
                <td className="px-4 py-3">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div>{row.actor.name}</div>
                  <div className="opacity-65">{row.actor.email}</div>
                </td>
                <td className="px-4 py-3">{row.action}</td>
                <td className="px-4 py-3">
                  {row.entityType} {row.entityId}
                </td>
                <td className="px-4 py-3">{row.scope?.name ?? "-"}</td>
                <td className="px-4 py-3">{row.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
