import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Role } from "../../../../generated/prisma/enums";

export default async function BackgroundJobsPage() {
  const user = await requireSession();
  const t = await getTranslations("backgroundJobs");

  if (user.role !== Role.PLATFORM_ADMIN) {
    redirect("/dashboard");
  }

  const jobs = await prisma.backgroundJob.findMany({
    include: {
      createdBy: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const summary = {
    pending: jobs.filter((job) => job.status === "PENDING").length,
    inProgress: jobs.filter((job) => job.status === "IN_PROGRESS").length,
    completed: jobs.filter((job) => job.status === "COMPLETED").length,
    failed: jobs.filter((job) => job.status === "FAILED").length,
  };

  return (
    <div>
      <p className="text-sm uppercase tracking-[0.2em] opacity-45">
        {t("eyebrow")}
      </p>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-4xl">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm opacity-70 sm:text-base">
            {t("description")}
          </p>
        </div>
        <p className="text-sm opacity-55">
          {t("showingRecent", { count: jobs.length })}
        </p>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={t("summary.pending")}
          value={summary.pending}
          tone="amber"
        />
        <SummaryCard
          label={t("summary.inProgress")}
          value={summary.inProgress}
          tone="blue"
        />
        <SummaryCard
          label={t("summary.completed")}
          value={summary.completed}
          tone="green"
        />
        <SummaryCard
          label={t("summary.failed")}
          value={summary.failed}
          tone="red"
        />
      </section>

      <section className="mt-8 space-y-4">
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-[var(--panel)] p-6 text-sm opacity-70 dark:border-white/15">
            {t("empty")}
          </div>
        ) : (
          jobs.map((job) => (
            <article
              key={job.id}
              className="rounded-2xl border border-black/10 bg-[var(--panel)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:border-white/10"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{job.jobType}</h2>
                    <StatusBadge status={job.status} />
                    {showRetryHint(job) ? (
                      <RetryBadge
                        label={t("retryScheduled", {
                          attempt: job.attemptCount + 1,
                          time: formatDate(job.availableAt),
                        })}
                      />
                    ) : null}
                  </div>
                  <p className="mt-2 break-all font-mono text-xs opacity-55">
                    {job.id}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm lg:min-w-[360px]">
                  <MetaRow
                    label={t("fields.createdAt")}
                    value={formatDate(job.createdAt)}
                  />
                  <MetaRow
                    label={t("fields.updatedAt")}
                    value={formatDate(job.updatedAt)}
                  />
                  <MetaRow
                    label={t("fields.attempts")}
                    value={String(job.attemptCount)}
                  />
                  <MetaRow
                    label={t("fields.worker")}
                    value={job.workerId ?? t("notAssigned")}
                  />
                  <MetaRow
                    label={t("fields.createdBy")}
                    value={
                      job.createdBy?.name || job.createdBy?.email || t("system")
                    }
                  />
                  <MetaRow
                    label={t("fields.availableAt")}
                    value={formatDate(job.availableAt)}
                  />
                </dl>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <CodeBlock
                  label={t("fields.payload")}
                  value={formatJson(job.payload)}
                />
                <CodeBlock
                  label={t("fields.result")}
                  value={formatJson(job.result)}
                />
                <CodeBlock
                  label={t("fields.error")}
                  value={job.error ?? t("none")}
                />
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "blue" | "green" | "red";
}) {
  const toneClass = {
    amber: "text-amber-700 dark:text-amber-300",
    blue: "text-blue-700 dark:text-blue-300",
    green: "text-emerald-700 dark:text-emerald-300",
    red: "text-rose-700 dark:text-rose-300",
  }[tone];

  return (
    <article className="rounded-2xl border border-black/10 bg-[var(--panel)] p-5 dark:border-white/10">
      <p className="text-sm uppercase tracking-[0.2em] opacity-45">{label}</p>
      <p className={`mt-3 text-3xl font-semibold ${toneClass}`}>{value}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    {
      PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      IN_PROGRESS: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
      COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      FAILED: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    }[status] ?? "bg-slate-500/15 text-slate-700 dark:text-slate-300";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}

function RetryBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
      {label}
    </span>
  );
}

function showRetryHint(job: {
  status: string;
  attemptCount: number;
  error: string | null;
  availableAt: Date;
  updatedAt: Date;
}) {
  return (
    job.status === "PENDING" &&
    job.attemptCount > 0 &&
    Boolean(job.error) &&
    job.availableAt.getTime() > job.updatedAt.getTime()
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="opacity-50">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </>
  );
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-2xl bg-black/[0.04] p-4 dark:bg-white/[0.04]">
      <p className="text-xs uppercase tracking-[0.18em] opacity-45">{label}</p>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs opacity-85">
        {value}
      </pre>
    </section>
  );
}

function formatDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatJson(value: string | null) {
  if (!value) {
    return "-";
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
