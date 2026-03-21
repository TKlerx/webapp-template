"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { withBasePath } from "@/lib/base-path";

type ReviewDashboardProps = {
  defaultCountryId?: string;
};

type ReceiptRow = {
  id: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  reviewStatus: "PENDING_REVIEW" | "APPROVED" | "FLAGGED" | "REJECTED";
  submitter: { name: string; email: string };
  budgetItem: { name: string };
  country: { id: string; name: string };
};

export function ReviewDashboard({ defaultCountryId }: ReviewDashboardProps) {
  const t = useTranslations("review");
  const [filters, setFilters] = useState({
    country: defaultCountryId ?? "",
    status: "",
    submitter: "",
  });
  const [rows, setRows] = useState<ReceiptRow[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("review", "true");
    if (filters.country) params.set("country", filters.country);
    if (filters.status) params.set("status", filters.status);
    if (filters.submitter) params.set("submitter", filters.submitter);

    void fetch(withBasePath(`/api/receipts?${params.toString()}`))
      .then((response) => response.json())
      .then((payload: { data: ReceiptRow[] }) => setRows(payload.data ?? []));
  }, [filters]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 rounded-2xl border border-black/10 bg-[var(--panel)] p-4 sm:grid-cols-3 dark:border-white/10">
        <input
          className="rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm outline-none dark:border-white/10"
          onChange={(event) => setFilters((current) => ({ ...current, country: event.target.value }))}
          placeholder={t("filters")}
          value={filters.country}
        />
        <select
          className="rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm outline-none dark:border-white/10"
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          value={filters.status}
        >
          <option value="">{t("status")}</option>
          <option value="PENDING_REVIEW">{t("pending")}</option>
          <option value="APPROVED">{t("approved")}</option>
          <option value="FLAGGED">{t("flagged")}</option>
          <option value="REJECTED">{t("rejected")}</option>
        </select>
        <input
          className="rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm outline-none dark:border-white/10"
          onChange={(event) => setFilters((current) => ({ ...current, submitter: event.target.value }))}
          placeholder={t("submitter")}
          value={filters.submitter}
        />
      </section>

      <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
        <table className="min-w-full bg-[var(--panel)] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/10">
              <th className="px-4 py-3">{t("status")}</th>
              <th className="px-4 py-3">{t("submitter")}</th>
              <th className="px-4 py-3">{t("budgetItem")}</th>
              <th className="px-4 py-3">{t("title")}</th>
              <th className="px-4 py-3">{t("openReceipt")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-black/5 dark:border-white/5">
                <td className="px-4 py-3">
                  <StatusBadge status={row.reviewStatus} />
                </td>
                <td className="px-4 py-3">
                  <div>{row.submitter.name}</div>
                  <div className="opacity-65">{row.submitter.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{row.country.name}</div>
                  <div className="opacity-65">{row.budgetItem.name}</div>
                </td>
                <td className="px-4 py-3">
                  {row.amount} {row.currency} - {new Date(row.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link className="underline" href={`/review/${row.id}`}>
                    {t("openReceipt")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
