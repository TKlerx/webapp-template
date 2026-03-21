"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/base-path";

type BudgetYear = {
  id: string;
  label: string;
};

type Summary = {
  countryBudgetId: string;
  countryName: string;
  totalBudget: number;
  approvedSpend: number;
  totalSpend: number;
  percentUsed: number;
  currency: string;
  statusCounts: {
    pending: number;
    approved: number;
    flagged: number;
    rejected: number;
  };
};

export function ComplianceDashboard({ budgetYears }: { budgetYears: BudgetYear[] }) {
  const [budgetYearId, setBudgetYearId] = useState(budgetYears[0]?.id ?? "");
  const [statusFilter, setStatusFilter] = useState<"approved" | "all">("all");
  const [rows, setRows] = useState<Summary[]>([]);

  useEffect(() => {
    if (!budgetYearId) {
      return;
    }

    const params = new URLSearchParams({
      budgetYearId,
      statusFilter,
    });

    void fetch(withBasePath(`/api/compliance?${params.toString()}`))
      .then((response) => response.json())
      .then((payload: { data: Summary[] }) => setRows(payload.data ?? []));
  }, [budgetYearId, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm dark:border-white/10"
          onChange={(event) => setBudgetYearId(event.target.value)}
          value={budgetYearId}
        >
          {budgetYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm dark:border-white/10"
          onChange={(event) => setStatusFilter(event.target.value as "approved" | "all")}
          value={statusFilter}
        >
          <option value="all">All receipts</option>
          <option value="approved">Approved only</option>
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((row) => (
          <article
            key={row.countryBudgetId}
            className="rounded-2xl border border-black/10 bg-[var(--panel)] p-5 dark:border-white/10"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{row.countryName}</h2>
              <Link className="underline" href={`/compliance/${row.countryBudgetId}`}>
                Drill down
              </Link>
            </div>
            <p className="mt-4 text-sm opacity-75">
              Budget {row.totalBudget} {row.currency} | Approved {row.approvedSpend} | Total {row.totalSpend}
            </p>
            <p className="mt-2 text-sm opacity-75">
              P {row.statusCounts.pending} | A {row.statusCounts.approved} | F {row.statusCounts.flagged} | R {row.statusCounts.rejected}
            </p>
            <p className="mt-4 text-2xl font-semibold">{row.percentUsed}%</p>
          </article>
        ))}
      </div>
    </div>
  );
}
