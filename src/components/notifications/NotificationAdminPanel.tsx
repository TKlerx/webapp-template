"use client";

import { useRef, useState } from "react";
import { Badge, Button, Checkbox, NativeSelect, Table } from "@mantine/core";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/base-path";
import { useToast } from "@/components/ui/Toast";

type NotificationConfig = {
  eventType: string;
  enabled: boolean;
  updatedByUserId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type NotificationLogRow = {
  id: string;
  eventId: string;
  eventType: string;
  recipientEmail: string;
  locale: string;
  subject: string;
  status: string;
  retryCount: number;
  providerMessageId: string | null;
  lastError: string | null;
  sentAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

const ALL_FILTER = "all";
const LOG_STATUSES = [
  "QUEUED",
  "SENDING",
  "RETRYING",
  "SENT",
  "FAILED",
  "BOUNCED",
];

export function NotificationAdminPanel({
  initialConfigs,
  initialNotifications,
}: {
  initialConfigs: NotificationConfig[];
  initialNotifications: NotificationLogRow[];
}) {
  const t = useTranslations("notifications");
  const { pushToast } = useToast();
  const [configs, setConfigs] = useState(initialConfigs);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [eventTypeFilter, setEventTypeFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const pendingSaves = useRef(new Set<string>());
  const [busyEventTypes, setBusyEventTypes] = useState(new Set<string>());
  const latestLogRequest = useRef(0);

  async function refreshNotifications(
    nextEventType = eventTypeFilter,
    nextStatus = statusFilter,
  ) {
    const requestId = ++latestLogRequest.current;
    setLoading(true);
    setLoadError(false);
    setNotifications([]);
    try {
      const params = new URLSearchParams();
      if (nextEventType !== ALL_FILTER) {
        params.set("eventType", nextEventType);
      }
      if (nextStatus !== ALL_FILTER) {
        params.set("status", nextStatus);
      }

      const suffix = params.toString();
      const response = await fetch(
        withBasePath(`/api/notifications${suffix ? `?${suffix}` : ""}`),
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        notifications?: NotificationLogRow[];
      } | null;

      if (requestId !== latestLogRequest.current) return;

      if (!response.ok || !Array.isArray(payload?.notifications)) {
        setLoadError(true);
        return;
      }

      setNotifications(payload.notifications);
    } catch {
      if (requestId === latestLogRequest.current) setLoadError(true);
    } finally {
      if (requestId === latestLogRequest.current) setLoading(false);
    }
  }

  async function toggleConfig(config: NotificationConfig, enabled: boolean) {
    const { eventType } = config;
    if (pendingSaves.current.has(eventType)) return;
    pendingSaves.current.add(eventType);
    setBusyEventTypes(new Set(pendingSaves.current));
    try {
      const response = await fetch(
        withBasePath(
          `/api/notifications/settings/${encodeURIComponent(config.eventType)}`,
        ),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ enabled }),
        },
      );

      const payload = (await response.json()) as {
        config?: NotificationConfig;
      } | null;
      const saved = payload?.config;

      if (
        !response.ok ||
        saved?.eventType !== eventType ||
        typeof saved.enabled !== "boolean" ||
        typeof saved.updatedAt !== "string" ||
        Number.isNaN(Date.parse(saved.updatedAt))
      ) {
        pushToast(t("saveFailed"));
        return;
      }

      setConfigs((current) =>
        current.map((item) => (item.eventType === eventType ? saved : item)),
      );
      pushToast(saved.enabled ? t("enabledSaved") : t("disabledSaved"));
    } catch {
      pushToast(t("saveFailed"));
    } finally {
      pendingSaves.current.delete(eventType);
      setBusyEventTypes(new Set(pendingSaves.current));
    }
  }

  const summary = {
    queued: notifications.filter(
      (item) => item.status === "QUEUED" || item.status === "RETRYING",
    ).length,
    sent: notifications.filter((item) => item.status === "SENT").length,
    failed: notifications.filter(
      (item) => item.status === "FAILED" || item.status === "BOUNCED",
    ).length,
  };

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t("settingsTitle")}</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {t("settingsDescription")}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {configs.map((config) => (
            <article
              key={config.eventType}
              className="min-w-0 rounded-lg border border-[var(--border)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {t(`eventTypes.${config.eventType}`)}
                  </h3>
                  <p className="mt-1 font-mono text-xs break-all text-[var(--muted-foreground)]">
                    {config.eventType}
                  </p>
                </div>
                <Checkbox
                  aria-label={t(`eventTypes.${config.eventType}`)}
                  checked={config.enabled}
                  disabled={busyEventTypes.has(config.eventType)}
                  label={config.enabled ? t("enabled") : t("disabled")}
                  onChange={(event) =>
                    void toggleConfig(config, event.currentTarget.checked)
                  }
                />
              </div>
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                {t("updatedAt", { value: formatDate(config.updatedAt) })}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t("logTitle")}</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {t("logDescription")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NativeSelect
              label={t("eventFilter")}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setEventTypeFilter(value);
                void refreshNotifications(value, statusFilter);
              }}
              value={eventTypeFilter}
              data={[
                { value: ALL_FILTER, label: t("allEvents") },
                ...configs.map(({ eventType }) => ({
                  value: eventType,
                  label: t(`eventTypes.${eventType}`),
                })),
              ]}
            />

            <NativeSelect
              label={t("statusFilter")}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setStatusFilter(value);
                void refreshNotifications(eventTypeFilter, value);
              }}
              value={statusFilter}
              data={[
                { value: ALL_FILTER, label: t("allStatuses") },
                ...LOG_STATUSES.map((status) => ({
                  value: status,
                  label: t(`statuses.${status}`),
                })),
              ]}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label={t("summaryQueued")} value={summary.queued} />
          <SummaryCard label={t("summarySent")} value={summary.sent} />
          <SummaryCard label={t("summaryFailed")} value={summary.failed} />
        </div>

        {loadError ? (
          <div className="space-y-2">
            <p role="alert">{t("loadFailed")}</p>
            <Button
              type="button"
              onClick={() => void refreshNotifications()}
              variant="default"
            >
              {t("retry")}
            </Button>
          </div>
        ) : loading ? null : notifications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] p-6 text-sm text-[var(--muted-foreground)]">
            {t("empty")}
          </div>
        ) : (
          <Table.ScrollContainer
            aria-label={t("logTitle")}
            className="rounded-lg border border-[var(--border)]"
            minWidth={760}
            role="region"
            tabIndex={0}
            type="native"
          >
            <Table aria-label={t("logTitle")}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("createdAtLabel")}</Table.Th>
                  <Table.Th>{t("eventLabel")}</Table.Th>
                  <Table.Th>{t("recipientLabel")}</Table.Th>
                  <Table.Th>{t("statusLabel")}</Table.Th>
                  <Table.Th>{t("subjectLabel")}</Table.Th>
                  <Table.Th>{t("detailsLabel")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {notifications.map((notification) => (
                  <Table.Tr key={notification.id}>
                    <Table.Td>{formatDate(notification.createdAt)}</Table.Td>
                    <Table.Td>
                      <div className="font-medium">
                        {t(`eventTypes.${notification.eventType}`)}
                      </div>
                      <div className="font-mono text-xs text-[var(--muted-foreground)]">
                        {notification.eventType}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div>{notification.recipientEmail}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {t("localeValue", { locale: notification.locale })}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light">
                        {t(`statuses.${notification.status}`)}
                      </Badge>
                    </Table.Td>
                    <Table.Td className="max-w-[20rem] truncate">
                      {notification.subject}
                    </Table.Td>
                    <Table.Td>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {notification.sentAt
                          ? t("sentAtValue", {
                              value: formatDate(notification.sentAt),
                            })
                          : t("notSentYet")}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {t("retryCountValue", {
                          count: notification.retryCount,
                        })}
                      </div>
                      {notification.lastError ? (
                        <div className="mt-1 max-w-[18rem] text-xs text-rose-700 dark:text-rose-300">
                          {notification.lastError}
                        </div>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}

        {loading ? (
          <p className="text-sm text-[var(--muted-foreground)]" role="status">
            {t("loading")}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-3 font-mono text-3xl font-semibold">{value}</p>
    </article>
  );
}

function formatDate(value: string | Date | null) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
