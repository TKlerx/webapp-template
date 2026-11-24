"use client";

import { DataTable } from "mantine-datatable";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/base-path";
import { AuditExportButton } from "@/components/audit/AuditExportButton";
import { Button } from "@/components/ui/Button";
import "./audit-table.css";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
  actor: { name: string; email: string } | null;
  scope?: { name: string } | null;
};

export function AuditTrailViewer() {
  const t = useTranslations("audit");
  const commonT = useTranslations("common");
  const [filters, setFilters] = useState({
    action: "",
    entityType: "",
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, limit: 25 });
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.action) params.set("action", filters.action);
    if (filters.entityType) params.set("entityType", filters.entityType);
    return params.toString();
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAuditRows() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(queryString);
        params.set("page", String(page));
        const suffix = `?${params}`;
        const response = await fetch(withBasePath(`/api/audit${suffix}`), {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as {
          data?: AuditRow[];
          error?: string;
          total?: number;
          limit?: number;
        } | null;

        if (controller.signal.aborted) return;
        if (!response.ok) {
          setError(payload?.error ?? commonT("error"));
          setRows([]);
          return;
        }

        setRows(payload?.data ?? []);
        setPagination({
          total: payload?.total ?? 0,
          limit: payload?.limit || 25,
        });
      } catch (fetchError) {
        if ((fetchError as Error).name !== "AbortError") {
          setError(commonT("error"));
          setRows([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadAuditRows();

    return () => controller.abort();
  }, [commonT, page, queryString]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            <span className="text-[var(--muted-foreground)]">
              {t("action")}
            </span>
            <input
              className="min-h-11 rounded-lg border border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  action: event.target.value,
                }));
              }}
              placeholder={t("action")}
              value={filters.action}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span className="text-[var(--muted-foreground)]">
              {t("entity")}
            </span>
            <input
              className="min-h-11 rounded-lg border border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  entityType: event.target.value,
                }));
              }}
              placeholder={t("entity")}
              value={filters.entityType}
            />
          </label>
        </div>
        <AuditExportButton queryString={queryString} />
      </div>

      <DataTable
        aria-label={t("title")}
        backgroundColor="var(--panel)"
        borderColor="var(--border)"
        borderRadius="md"
        classNames={{ table: "min-w-[52rem]" }}
        columns={[
          {
            accessor: "createdAt",
            title: t("date"),
            render: ({ createdAt }) => (
              <span className="font-mono text-xs text-[var(--muted-foreground)]">
                {new Date(createdAt).toLocaleString()}
              </span>
            ),
          },
          {
            accessor: "actor",
            title: t("actor"),
            render: ({ actor }) => (
              <>
                <div className="font-medium">
                  {actor?.name ?? t("anonymous")}
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {actor?.email}
                </div>
              </>
            ),
          },
          {
            accessor: "action",
            title: t("action"),
            render: ({ action }) => (
              <span className="inline-block rounded-full border border-[var(--border)] bg-[var(--secondary)] px-3 py-1 text-xs font-semibold text-[var(--secondary-foreground)]">
                {action}
              </span>
            ),
          },
          {
            accessor: "entityType",
            title: t("entity"),
            render: ({ entityType, entityId }) => (
              <>
                <div className="font-medium">{entityType}</div>
                <div className="font-mono text-xs text-[var(--muted-foreground)]">
                  {entityId}
                </div>
              </>
            ),
          },
          {
            accessor: "scope",
            title: t("scope"),
            render: ({ scope }) => scope?.name ?? "-",
          },
          {
            accessor: "details",
            title: t("details"),
            render: ({ details }) => (
              <p className="max-w-96 [overflow-wrap:anywhere] text-[var(--muted-foreground)]">
                {details}
              </p>
            ),
          },
        ]}
        emptyState={
          <p
            role={error ? "alert" : undefined}
            className={
              error
                ? "text-sm text-[var(--destructive)]"
                : "text-sm text-[var(--muted-foreground)]"
            }
          >
            {error ?? t("empty")}
          </p>
        }
        fetching={loading}
        getPaginationControlProps={(control) => ({
          "aria-label": t(control === "previous" ? "previousPage" : "nextPage"),
        })}
        getPaginationItemProps={(targetPage) => ({
          "aria-label": t("pageIndicator", {
            page: targetPage,
            total: Math.ceil(pagination.total / pagination.limit),
          }),
        })}
        highlightOnHover
        horizontalSpacing="md"
        loadingText={commonT("loading")}
        minHeight={160}
        onPageChange={setPage}
        page={page}
        records={rows}
        recordsPerPage={pagination.limit}
        rowBorderColor="var(--border)"
        totalRecords={error ? 0 : pagination.total}
        verticalAlign="top"
        verticalSpacing="md"
        withTableBorder
      />
      {!loading && page > 1 && rows.length === 0 && (
        <nav aria-label={t("paginationLabel")} className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPage(page - 1)}
          >
            {t("previousPage")}
          </Button>
        </nav>
      )}
    </div>
  );
}
