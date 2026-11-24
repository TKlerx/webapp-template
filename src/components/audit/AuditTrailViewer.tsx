"use client";

import { Pagination, TextInput } from "@mantine/core";
import { usePagination } from "@mantine/hooks";
import { DataTable } from "mantine-datatable";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

const filterClassNames = {
  label: "mb-2 text-sm font-medium text-[var(--muted-foreground)]",
  input:
    "min-h-11 rounded-lg border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
};

export function AuditTrailViewer() {
  const t = useTranslations("audit");
  const commonT = useTranslations("common");
  const [filters, setFilters] = useState({
    action: "",
    entityType: "",
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    total: number;
    limit: number;
  } | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const pagerRef = useRef<HTMLElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const focusedPageControl = useRef<Element | null>(null);

  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.limit))
    : 1;
  const pager = usePagination({ page, total: totalPages, onChange: setPage });
  const firstRecord = pagination ? (page - 1) * pagination.limit + 1 : 0;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.action) params.set("action", filters.action);
    if (filters.entityType) params.set("entityType", filters.entityType);
    return params.toString();
  }, [filters]);

  function focusAuditResults() {
    const target =
      pagerRef.current?.querySelector<HTMLButtonElement>(
        '[aria-current="page"]',
      ) ?? tableRef.current;
    target?.focus();
  }

  useLayoutEffect(() => {
    const control = focusedPageControl.current;
    focusedPageControl.current = null;
    if (
      control &&
      !control.isConnected &&
      document.activeElement === document.body
    ) {
      focusAuditResults();
    }
  }, [pagination]);

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
        const total = payload?.total ?? 0;
        const limit = payload?.limit || 25;
        const lastPage = Math.max(1, Math.ceil(total / limit));
        const activeElement = document.activeElement;
        if (pagerRef.current?.contains(activeElement)) {
          focusedPageControl.current = activeElement;
        }
        setPagination({ total, limit });
        if (page > lastPage) setPage(lastPage);
      } catch (fetchError) {
        if (
          !controller.signal.aborted &&
          (fetchError as Error).name !== "AbortError"
        ) {
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
  }, [commonT, page, queryString, retryCount]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            classNames={filterClassNames}
            label={t("action")}
            onChange={(event) => {
              const action = event.currentTarget.value;
              setPage(1);
              setPagination(null);
              setFilters((current) => ({ ...current, action }));
            }}
            placeholder={t("action")}
            value={filters.action}
          />
          <TextInput
            classNames={filterClassNames}
            label={t("entity")}
            onChange={(event) => {
              const entityType = event.currentTarget.value;
              setPage(1);
              setPagination(null);
              setFilters((current) => ({ ...current, entityType }));
            }}
            placeholder={t("entity")}
            value={filters.entityType}
          />
        </div>
        <AuditExportButton queryString={queryString} />
      </div>

      {totalPages > 1 && (
        <nav
          ref={pagerRef}
          aria-label={t("paginationLabel")}
          className="flex flex-wrap items-center gap-2"
        >
          <Button
            type="button"
            variant="secondary"
            aria-disabled={page === 1}
            className="aria-disabled:opacity-60"
            onClick={pager.previous}
          >
            {t("previousPage")}
          </Button>
          <Pagination.Root
            total={totalPages}
            value={page}
            size="sm"
            className="flex flex-wrap gap-1"
          >
            {pager.range.map((target, index) =>
              target === "dots" ? (
                <Pagination.Dots key={`dots-${index}`} />
              ) : (
                <Pagination.Control
                  key={target}
                  active={target === page}
                  aria-current={target === page ? "page" : undefined}
                  aria-label={t("pageIndicator", {
                    page: target,
                    total: totalPages,
                  })}
                  onClick={() => {
                    if (error && target === page) {
                      setRetryCount((count) => count + 1);
                    } else {
                      pager.setPage(target);
                    }
                  }}
                >
                  {target}
                </Pagination.Control>
              ),
            )}
          </Pagination.Root>
          <Button
            type="button"
            variant="secondary"
            aria-disabled={page === totalPages}
            className="aria-disabled:opacity-60"
            onClick={pager.next}
          >
            {t("nextPage")}
          </Button>
          <span className="sr-only" aria-live="polite">
            {t("pageIndicator", { page, total: totalPages })}
          </span>
        </nav>
      )}
      {error && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            focusAuditResults();
            setRetryCount((count) => count + 1);
          }}
        >
          {t("retry")}
        </Button>
      )}

      <DataTable
        aria-label={t("title")}
        aria-busy={loading}
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
        highlightOnHover
        horizontalSpacing="md"
        minHeight={160}
        records={rows}
        tabIndex={-1}
        tableRef={(table) => {
          tableRef.current = table;
        }}
        rowBorderColor="var(--border)"
        verticalAlign="top"
        verticalSpacing="md"
        withTableBorder
      />
      {!loading && pagination && rows.length > 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">
          {firstRecord} - {firstRecord + rows.length - 1} / {pagination.total}
        </p>
      )}
    </div>
  );
}
