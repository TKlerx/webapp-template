"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/base-path";
import { useToast } from "@/components/ui/Toast";
import { Button, Checkbox, TextInput } from "@mantine/core";

type TeamsConfigResponse = {
  sendEnabled: boolean;
  intakeEnabled: boolean;
  updatedAt: string | Date;
  health: {
    lastSuccessfulSend: string | Date | null;
    lastSuccessfulIntake: string | Date | null;
    recentSendFailures: number;
    recentIntakeFailures: number;
  };
  recentActivity: Array<Record<string, unknown>>;
};

type TeamsDeliveryTarget = {
  id: string;
  name: string;
  teamId: string;
  channelId: string;
  teamName: string | null;
  channelName: string | null;
  active: boolean;
  createdAt: string | Date;
};

type TeamsIntakeSubscription = {
  id: string;
  teamId: string;
  channelId: string;
  teamName: string | null;
  channelName: string | null;
  active: boolean;
  lastPolledAt: string | Date | null;
  createdAt: string | Date;
};

type TeamsConsentStatus = {
  connected: boolean;
  scope: string | null;
  expiresAt: string | Date | null;
  updatedAt: string | Date | null;
};

const emptySubscription = {
  teamId: "",
  channelId: "",
  teamName: "",
  channelName: "",
};
const emptyTarget = { name: "", ...emptySubscription };

export function TeamsIntegrationPanel({
  initialConfig,
  initialTargets,
  initialSubscriptions,
  initialConsentStatus,
}: {
  initialConfig: TeamsConfigResponse;
  initialTargets: TeamsDeliveryTarget[];
  initialSubscriptions: TeamsIntakeSubscription[];
  initialConsentStatus: TeamsConsentStatus;
}) {
  const t = useTranslations("teams");
  const { pushToast } = useToast();
  const [config, setConfig] = useState(initialConfig);
  const [targets, setTargets] = useState(initialTargets);
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const consentStatus = initialConsentStatus;
  const pendingActions = useRef(new Set<string>());
  const [pending, setPending] = useState(new Set<string>());
  const [targetLink, setTargetLink] = useState("");
  const [subscriptionLink, setSubscriptionLink] = useState("");
  const [newTarget, setNewTarget] = useState(emptyTarget);
  const [newSubscription, setNewSubscription] = useState(emptySubscription);

  const healthCards = useMemo(
    () => [
      {
        label: t("health.sendFailures"),
        value: config.health.recentSendFailures,
      },
      {
        label: t("health.intakeFailures"),
        value: config.health.recentIntakeFailures,
      },
      {
        label: t("health.lastSend"),
        value: config.health.lastSuccessfulSend
          ? formatDate(config.health.lastSuccessfulSend)
          : "-",
      },
      {
        label: t("health.lastIntake"),
        value: config.health.lastSuccessfulIntake
          ? formatDate(config.health.lastSuccessfulIntake)
          : "-",
      },
    ],
    [config.health, t],
  );
  const sendWarnings = useMemo(() => {
    return config.recentActivity
      .filter(
        (item) =>
          item.type === "send" &&
          item.status === "FAILED" &&
          typeof item.error === "string",
      )
      .map((item) => ({
        targetName: String(item.targetName ?? "-"),
        timestamp: String(item.timestamp ?? ""),
        error: String(item.error),
      }))
      .filter((item) => isArchivedChannelSendError(item.error));
  }, [config.recentActivity]);

  function applyLinkToTarget() {
    const parsed = parseTeamsChannelLink(targetLink);
    if (!parsed) {
      pushToast(t("linkParser.invalid"));
      return;
    }

    setNewTarget((current) => ({
      ...current,
      teamId: parsed.teamId,
      channelId: parsed.channelId,
      channelName: current.channelName || parsed.channelName,
      name: current.name || parsed.channelName || current.name,
    }));
    pushToast(t("linkParser.applied"));
  }

  function applyLinkToSubscription() {
    const parsed = parseTeamsChannelLink(subscriptionLink);
    if (!parsed) {
      pushToast(t("linkParser.invalid"));
      return;
    }

    setNewSubscription((current) => ({
      ...current,
      teamId: parsed.teamId,
      channelId: parsed.channelId,
      channelName: current.channelName || parsed.channelName,
    }));
    pushToast(t("linkParser.applied"));
  }

  async function runMutation(
    key: string,
    failure: string,
    work: () => Promise<void>,
  ) {
    if (pendingActions.current.has(key)) return;
    pendingActions.current.add(key);
    setPending(new Set(pendingActions.current));
    try {
      await work();
    } catch {
      pushToast(failure);
    } finally {
      pendingActions.current.delete(key);
      setPending(new Set(pendingActions.current));
    }
  }

  async function request(path: string, method: string, body?: object) {
    const response = await fetch(
      withBasePath(`/api/integrations/teams${path}`),
      {
        method,
        ...(body && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      },
    );
    if (!response.ok) throw new Error("Teams settings request failed");
    return response;
  }

  function saveConfig(
    next: Partial<Pick<TeamsConfigResponse, "sendEnabled" | "intakeEnabled">>,
  ) {
    return runMutation("config", t("messages.saveFailed"), async () => {
      const response = await request("", "PUT", next);
      const saved = (await response.json()) as TeamsConfigResponse;
      setConfig(saved);
      pushToast(t("messages.saved"));
    });
  }

  function addTarget() {
    return runMutation(
      "addTarget",
      t("messages.targetCreateFailed"),
      async () => {
        const response = await request("/targets", "POST", newTarget);
        const { target } = (await response.json()) as {
          target: TeamsDeliveryTarget;
        };
        if (!target?.id) throw new Error("Unexpected Teams target response");
        setTargets((current) => [target, ...current]);
        setNewTarget(emptyTarget);
        pushToast(t("messages.targetCreated"));
      },
    );
  }

  function toggleTarget(id: string, active: boolean) {
    return runMutation(
      `target:${id}`,
      t("messages.targetUpdateFailed"),
      async () => {
        const response = await request(
          `/targets/${encodeURIComponent(id)}`,
          "PUT",
          { active },
        );
        const { target } = (await response.json()) as {
          target: TeamsDeliveryTarget;
        };
        if (target?.id !== id)
          throw new Error("Unexpected Teams target response");
        setTargets((current) =>
          current.map((item) => (item.id === id ? target : item)),
        );
      },
    );
  }

  function removeTarget(id: string) {
    return runMutation(
      `target:${id}`,
      t("messages.targetDeleteFailed"),
      async () => {
        await request(`/targets/${encodeURIComponent(id)}`, "DELETE");
        setTargets((current) => current.filter((item) => item.id !== id));
      },
    );
  }

  function addSubscription() {
    return runMutation(
      "addSubscription",
      t("messages.subscriptionCreateFailed"),
      async () => {
        const response = await request(
          "/subscriptions",
          "POST",
          newSubscription,
        );
        const { subscription } = (await response.json()) as {
          subscription: TeamsIntakeSubscription;
        };
        if (!subscription?.id)
          throw new Error("Unexpected Teams subscription response");
        setSubscriptions((current) => [subscription, ...current]);
        setNewSubscription(emptySubscription);
        pushToast(t("messages.subscriptionCreated"));
      },
    );
  }

  function toggleSubscription(id: string, active: boolean) {
    return runMutation(
      `subscription:${id}`,
      t("messages.subscriptionUpdateFailed"),
      async () => {
        const response = await request(
          `/subscriptions/${encodeURIComponent(id)}`,
          "PUT",
          { active },
        );
        const { subscription } = (await response.json()) as {
          subscription: TeamsIntakeSubscription;
        };
        if (subscription?.id !== id)
          throw new Error("Unexpected Teams subscription response");
        setSubscriptions((current) =>
          current.map((item) => (item.id === id ? subscription : item)),
        );
      },
    );
  }

  function removeSubscription(id: string) {
    return runMutation(
      `subscription:${id}`,
      t("messages.subscriptionDeleteFailed"),
      async () => {
        await request(`/subscriptions/${encodeURIComponent(id)}`, "DELETE");
        setSubscriptions((current) => current.filter((item) => item.id !== id));
      },
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {t("consent.title")}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {consentStatus.connected
              ? t("consent.connected")
              : t("consent.notConnected")}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {consentStatus.expiresAt
              ? t("consent.expiresAt", {
                  value: formatDate(consentStatus.expiresAt),
                })
              : t("consent.noExpiry")}
          </p>
        </div>
        <Button
          component="a"
          href={withBasePath(
            "/api/integrations/teams/consent/start?redirectTo=/admin/integrations/teams",
          )}
        >
          {t("consent.connectButton")}
        </Button>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("toggles.title")}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Checkbox
            label={t("toggles.sendEnabled")}
            checked={config.sendEnabled}
            disabled={pending.has("config")}
            onChange={(event) =>
              void saveConfig({ sendEnabled: event.target.checked })
            }
          />
          <Checkbox
            label={t("toggles.intakeEnabled")}
            checked={config.intakeEnabled}
            disabled={pending.has("config")}
            onChange={(event) =>
              void saveConfig({ intakeEnabled: event.target.checked })
            }
          />
        </div>
      </section>

      <section
        aria-labelledby="teams-targets-title"
        className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5"
      >
        <h2
          className="text-lg font-semibold tracking-tight"
          id="teams-targets-title"
        >
          {t("targets.title")}
        </h2>
        <LinkParserControls
          label={t("linkParser.label")}
          placeholder={t("linkParser.placeholder")}
          buttonLabel={t("linkParser.apply")}
          value={targetLink}
          onChange={setTargetLink}
          onApply={applyLinkToTarget}
        />
        <fieldset
          className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5"
          disabled={pending.has("addTarget")}
        >
          <TextInput
            label={t("targets.name")}
            value={newTarget.name}
            onChange={(e) =>
              setNewTarget((v) => ({ ...v, name: e.target.value }))
            }
          />
          <TextInput
            label={t("targets.teamId")}
            value={newTarget.teamId}
            onChange={(e) =>
              setNewTarget((v) => ({ ...v, teamId: e.target.value }))
            }
          />
          <TextInput
            label={t("targets.channelId")}
            value={newTarget.channelId}
            onChange={(e) =>
              setNewTarget((v) => ({ ...v, channelId: e.target.value }))
            }
          />
          <TextInput
            label={t("targets.teamName")}
            value={newTarget.teamName}
            onChange={(e) =>
              setNewTarget((v) => ({ ...v, teamName: e.target.value }))
            }
          />
          <TextInput
            label={t("targets.channelName")}
            value={newTarget.channelName}
            onChange={(e) =>
              setNewTarget((v) => ({ ...v, channelName: e.target.value }))
            }
          />
        </fieldset>
        <Button
          className="mt-3"
          disabled={pending.has("addTarget")}
          onClick={() => void addTarget()}
          type="button"
        >
          {t("targets.add")}
        </Button>
        <div className="mt-4 space-y-2">
          {targets.length === 0 && <p>{t("emptyTargets")}</p>}
          {targets.map((target) => (
            <article
              aria-label={target.name}
              key={target.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--panel)_88%,var(--background)_12%)] p-3"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-medium">{target.name}</p>
                <p className="break-all font-mono text-xs text-[var(--muted-foreground)]">
                  {target.teamId} / {target.channelId}
                </p>
              </div>
              <ActiveDeleteControls
                active={target.active}
                activeLabel={t("common.active")}
                inactiveLabel={t("common.inactive")}
                deleteLabel={t("common.delete")}
                disabled={pending.has(`target:${target.id}`)}
                onToggle={(next) => void toggleTarget(target.id, next)}
                onDelete={() => void removeTarget(target.id)}
              />
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="teams-subscriptions-title"
        className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5"
      >
        <h2
          className="text-lg font-semibold tracking-tight"
          id="teams-subscriptions-title"
        >
          {t("subscriptions.title")}
        </h2>
        <LinkParserControls
          label={t("linkParser.label")}
          placeholder={t("linkParser.placeholder")}
          buttonLabel={t("linkParser.apply")}
          value={subscriptionLink}
          onChange={setSubscriptionLink}
          onApply={applyLinkToSubscription}
        />
        <fieldset
          className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4"
          disabled={pending.has("addSubscription")}
        >
          <TextInput
            label={t("subscriptions.teamId")}
            value={newSubscription.teamId}
            onChange={(e) =>
              setNewSubscription((v) => ({ ...v, teamId: e.target.value }))
            }
          />
          <TextInput
            label={t("subscriptions.channelId")}
            value={newSubscription.channelId}
            onChange={(e) =>
              setNewSubscription((v) => ({ ...v, channelId: e.target.value }))
            }
          />
          <TextInput
            label={t("subscriptions.teamName")}
            value={newSubscription.teamName}
            onChange={(e) =>
              setNewSubscription((v) => ({ ...v, teamName: e.target.value }))
            }
          />
          <TextInput
            label={t("subscriptions.channelName")}
            value={newSubscription.channelName}
            onChange={(e) =>
              setNewSubscription((v) => ({ ...v, channelName: e.target.value }))
            }
          />
        </fieldset>
        <Button
          className="mt-3"
          disabled={pending.has("addSubscription")}
          onClick={() => void addSubscription()}
          type="button"
        >
          {t("subscriptions.add")}
        </Button>
        <div className="mt-4 space-y-2">
          {subscriptions.length === 0 && <p>{t("emptySubscriptions")}</p>}
          {subscriptions.map((subscription) => (
            <div
              key={subscription.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--panel)_88%,var(--background)_12%)] p-3"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-medium break-words">
                  {subscription.teamName ?? subscription.teamId} /{" "}
                  {subscription.channelName ?? subscription.channelId}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("subscriptions.lastPolled")}:{" "}
                  {subscription.lastPolledAt
                    ? formatDate(subscription.lastPolledAt)
                    : "-"}
                </p>
              </div>
              <ActiveDeleteControls
                active={subscription.active}
                activeLabel={t("common.active")}
                inactiveLabel={t("common.inactive")}
                deleteLabel={t("common.delete")}
                disabled={pending.has(`subscription:${subscription.id}`)}
                onToggle={(next) =>
                  void toggleSubscription(subscription.id, next)
                }
                onDelete={() => void removeSubscription(subscription.id)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("health.title")}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {healthCards.map((card) => (
            <article
              key={card.label}
              className="rounded-lg border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--panel)_88%,var(--background)_12%)] p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                {card.label}
              </p>
              <p className="mt-2 font-mono text-lg font-semibold">
                {String(card.value)}
              </p>
            </article>
          ))}
        </div>
        {sendWarnings.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">
              {t("messages.archivedChannelWarning")}
            </p>
            <div className="mt-2 space-y-1 text-sm">
              {sendWarnings.slice(0, 3).map((warning) => (
                <p key={`${warning.targetName}-${warning.timestamp}`}>
                  {warning.targetName} -{" "}
                  {warning.timestamp ? formatDate(warning.timestamp) : "-"}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value instanceof Date ? value : new Date(value));
}

function isArchivedChannelSendError(error: string) {
  const normalized = error.toLowerCase();
  return (
    normalized.includes("archivemodifier") ||
    normalized.includes("aclcheckfailed-capability newpost") ||
    normalized.includes("insufficientprivileges")
  );
}

function parseTeamsChannelLink(link: string) {
  const value = link.trim();
  if (!value) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const teamId = url.searchParams.get("groupId")?.trim() ?? "";
  const parts = url.pathname.split("/").filter(Boolean);
  const channelIndex = parts.findIndex(
    (part) => part.toLowerCase() === "channel",
  );
  const rawChannelId = channelIndex >= 0 ? (parts[channelIndex + 1] ?? "") : "";
  const rawChannelName =
    channelIndex >= 0 ? (parts[channelIndex + 2] ?? "") : "";

  const channelId = decodeURIComponent(rawChannelId).trim();
  const channelName = decodeURIComponent(rawChannelName).trim();

  if (!teamId || !channelId) {
    return null;
  }

  return {
    teamId,
    channelId,
    channelName,
  };
}

function LinkParserControls({
  label,
  placeholder,
  buttonLabel,
  value,
  onChange,
  onApply,
}: {
  label: string;
  placeholder: string;
  buttonLabel: string;
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
}) {
  return (
    <>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <TextInput
          className="min-w-0 flex-1 basis-48"
          label={label}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button onClick={onApply} type="button" variant="default">
          {buttonLabel}
        </Button>
      </div>
    </>
  );
}

function ActiveDeleteControls({
  active,
  activeLabel,
  inactiveLabel,
  deleteLabel,
  disabled,
  onToggle,
  onDelete,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  deleteLabel: string;
  disabled: boolean;
  onToggle: (next: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Checkbox
        checked={active}
        disabled={disabled}
        label={active ? activeLabel : inactiveLabel}
        onChange={(event) => onToggle(event.target.checked)}
      />
      <Button
        disabled={disabled}
        onClick={onDelete}
        type="button"
        variant="default"
      >
        {deleteLabel}
      </Button>
    </>
  );
}
