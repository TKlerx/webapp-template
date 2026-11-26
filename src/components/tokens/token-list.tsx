"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Checkbox,
  Modal,
  NativeSelect,
  Table,
} from "@mantine/core";
import { useToast } from "@/components/ui/Toast";
import { withBasePath } from "@/lib/base-path";
import { tokenActionResponseSchema } from "@/lib/api-response";
import {
  TokenValueDisplay,
  type TokenValuePayload,
} from "@/components/tokens/token-value-display";

type TokenItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  type: string;
  status: string;
  expiresAt: string | Date;
  lastUsedAt: string | Date | null;
  revokedAt: string | Date | null;
  renewalCount: number;
  createdAt: string | Date;
  isExpired: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

type UserFilterOption = {
  id: string;
  name: string;
  email: string;
};

type TokenAction = "revoke" | "renew" | "delete";

function formatDate(value: string | Date | null) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function TokenList({
  initialTokens,
  adminMode = false,
  users = [],
}: {
  initialTokens: TokenItem[];
  adminMode?: boolean;
  users?: UserFilterOption[];
}) {
  const t = useTranslations(adminMode ? "adminTokens" : "tokens");
  const sharedT = useTranslations("tokens");
  const router = useRouter();
  const { pushToast } = useToast();
  const [tokens, setTokens] = useState<TokenItem[]>(initialTokens);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    token: TokenItem;
    action: TokenAction;
  } | null>(null);
  const actionInProgress = useRef(false);
  const actionTrigger = useRef<HTMLButtonElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const [renewedToken, setRenewedToken] = useState<TokenValuePayload | null>(
    null,
  );
  const [userIdFilter, setUserIdFilter] = useState<string>("all");
  const selection = useRef({ showAll: false, userId: "all" });
  const latestRequest = useRef(0);

  useEffect(() => {
    if (adminMode) {
      return;
    }

    function handleTokenCreated(event: Event) {
      const payload = (event as CustomEvent<{ token?: TokenItem }>).detail;
      if (!payload?.token) {
        return;
      }

      setTokens((current) => {
        if (current.some((token) => token.id === payload.token!.id)) {
          return current;
        }

        return [payload.token!, ...current];
      });
    }

    window.addEventListener("tokens:created", handleTokenCreated);
    return () =>
      window.removeEventListener("tokens:created", handleTokenCreated);
  }, [adminMode]);

  async function refreshTokens(
    nextShowAll = selection.current.showAll,
    nextUserId = selection.current.userId,
  ) {
    const requestId = ++latestRequest.current;
    const changed =
      nextShowAll !== selection.current.showAll ||
      nextUserId !== selection.current.userId;
    selection.current = { showAll: nextShowAll, userId: nextUserId };
    if (changed) setTokens([]);
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (nextShowAll) {
        params.set("showAll", "true");
      }
      if (adminMode && nextUserId !== "all") {
        params.set("userId", nextUserId);
      }

      const url = adminMode ? "/api/admin/tokens" : "/api/tokens";
      const response = await fetch(withBasePath(`${url}?${params.toString()}`));
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        tokens?: TokenItem[];
      } | null;

      if (requestId !== latestRequest.current) return;
      if (!response.ok || !payload?.tokens) {
        pushToast(payload?.error ?? sharedT("loadFailed"));
        return;
      }

      setTokens(payload.tokens);
      router.refresh();
    } catch {
      if (requestId === latestRequest.current) pushToast(sharedT("loadFailed"));
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }

  async function runAction(token: TokenItem, action: TokenAction) {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setBusyId(token.id);
    setConfirmation(null);
    let revealsToken = false;

    try {
      const baseUrl = adminMode
        ? `/api/admin/tokens/${token.id}`
        : `/api/tokens/${token.id}`;
      const requestUrl =
        action === "revoke"
          ? `${baseUrl}/revoke`
          : action === "renew"
            ? `${baseUrl}/renew`
            : baseUrl;

      const response = await fetch(withBasePath(requestUrl), {
        method: action === "delete" ? "DELETE" : "POST",
        headers:
          action === "renew"
            ? {
                "Content-Type": "application/json",
              }
            : undefined,
        body: action === "renew" ? JSON.stringify({}) : undefined,
      });

      const parsed = tokenActionResponseSchema.safeParse(
        response.status === 204
          ? null
          : await response.json().catch(() => null),
      );
      const payload = parsed.success ? parsed.data : null;
      if (!response.ok) {
        pushToast(payload?.error ?? sharedT("updateFailed"));
        return;
      }

      if (action === "renew") {
        if (!payload?.token?.tokenValue) {
          pushToast(sharedT("updateFailed"));
          await refreshTokens();
          return;
        }
        setRenewedToken({
          name: payload.token.name ?? token.name,
          tokenValue: payload.token.tokenValue,
        });
        revealsToken = true;
      }

      pushToast(
        action === "revoke"
          ? sharedT("revoked")
          : action === "renew"
            ? sharedT("renewed")
            : sharedT("deleted"),
      );
      await refreshTokens();
    } catch {
      pushToast(sharedT("updateFailed"));
    } finally {
      actionInProgress.current = false;
      setBusyId(null);
      if (!revealsToken) restoreActionFocus();
    }
  }

  function confirmAction(
    trigger: HTMLButtonElement,
    token: TokenItem,
    action: TokenAction,
  ) {
    actionTrigger.current = trigger;
    setConfirmation({ token, action });
  }

  function restoreActionFocus() {
    requestAnimationFrame(() => {
      const trigger = actionTrigger.current;
      if (trigger?.isConnected && !trigger.disabled) trigger.focus();
      else listHeading.current?.focus();
    });
  }

  return (
    <>
      <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2
              className="text-xl font-semibold"
              ref={listHeading}
              tabIndex={-1}
            >
              {t("tableTitle")}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {t("tableDescription")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {adminMode ? (
              <NativeSelect
                aria-label={t("filterByUser")}
                className="min-w-0 max-w-full"
                data={[
                  { value: "all", label: t("allUsers") },
                  ...users.map((user) => ({
                    value: user.id,
                    label: `${user.name} (${user.email})`,
                  })),
                ]}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setUserIdFilter(value);
                  void refreshTokens(showAll, value);
                }}
                value={userIdFilter}
              />
            ) : null}
            <Checkbox
              checked={showAll}
              label={sharedT("showAll")}
              onChange={(event) => {
                const next = event.target.checked;
                setShowAll(next);
                void refreshTokens(next);
              }}
            />
          </div>
        </div>

        {tokens.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
            {sharedT("empty")}
          </div>
        ) : (
          <>
            <Table.ScrollContainer
              className="mt-6 hidden md:block"
              minWidth="48rem"
              type="native"
            >
              <Table aria-label={t("tableTitle")}>
                <Table.Thead>
                  <Table.Tr>
                    {adminMode ? <Table.Th>{t("user")}</Table.Th> : null}
                    <Table.Th>{sharedT("nameColumn")}</Table.Th>
                    <Table.Th>{sharedT("prefixColumn")}</Table.Th>
                    <Table.Th>{sharedT("typeColumn")}</Table.Th>
                    <Table.Th>{sharedT("statusColumn")}</Table.Th>
                    <Table.Th>{sharedT("expiresColumn")}</Table.Th>
                    <Table.Th>{sharedT("lastUsedColumn")}</Table.Th>
                    <Table.Th>{sharedT("createdColumn")}</Table.Th>
                    <Table.Th>{sharedT("actionsColumn")}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {tokens.map((token) => (
                    <Table.Tr key={token.id}>
                      {adminMode ? (
                        <Table.Td>
                          <div className="font-medium">
                            {token.user?.name ?? "—"}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)]">
                            {token.user?.email ?? "—"}
                          </div>
                        </Table.Td>
                      ) : null}
                      <Table.Td className="font-medium">{token.name}</Table.Td>
                      <Table.Td>{token.tokenPrefix}</Table.Td>
                      <Table.Td>{token.type}</Table.Td>
                      <Table.Td>
                        <Badge className="normal-case" variant="light">
                          {token.isExpired
                            ? sharedT("statusExpired")
                            : sharedT(`status.${token.status}`)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{formatDate(token.expiresAt)}</Table.Td>
                      <Table.Td>{formatDate(token.lastUsedAt)}</Table.Td>
                      <Table.Td>{formatDate(token.createdAt)}</Table.Td>
                      <Table.Td>
                        <div className="flex flex-wrap gap-2">
                          {!adminMode &&
                          token.status === "ACTIVE" &&
                          !token.isExpired ? (
                            <Button
                              disabled={busyId !== null}
                              onClick={(event) =>
                                confirmAction(
                                  event.currentTarget,
                                  token,
                                  "renew",
                                )
                              }
                              type="button"
                              variant="default"
                            >
                              {sharedT("renew")}
                            </Button>
                          ) : null}
                          {token.status === "ACTIVE" && !token.isExpired ? (
                            <Button
                              disabled={busyId !== null}
                              onClick={(event) =>
                                confirmAction(
                                  event.currentTarget,
                                  token,
                                  "revoke",
                                )
                              }
                              type="button"
                              variant="default"
                            >
                              {sharedT("revoke")}
                            </Button>
                          ) : null}
                          <Button
                            disabled={busyId !== null}
                            onClick={(event) =>
                              confirmAction(
                                event.currentTarget,
                                token,
                                "delete",
                              )
                            }
                            type="button"
                            variant="default"
                          >
                            {sharedT("delete")}
                          </Button>
                        </div>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            <div className="mt-6 grid gap-4 md:hidden">
              {tokens.map((token) => (
                <article
                  className="rounded-lg border border-[var(--border)] p-4"
                  key={token.id}
                >
                  {adminMode ? (
                    <p className="text-sm font-medium">
                      {token.user?.name}{" "}
                      <span className="text-[var(--muted-foreground)]">
                        ({token.user?.email})
                      </span>
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{token.name}</h3>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {sharedT("prefixColumn")}: {token.tokenPrefix}
                      </p>
                    </div>
                    <Badge className="normal-case" variant="light">
                      {token.isExpired
                        ? sharedT("statusExpired")
                        : sharedT(`status.${token.status}`)}
                    </Badge>
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--muted-foreground)]">
                        {sharedT("typeColumn")}
                      </dt>
                      <dd>{token.type}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--muted-foreground)]">
                        {sharedT("expiresColumn")}
                      </dt>
                      <dd>{formatDate(token.expiresAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--muted-foreground)]">
                        {sharedT("lastUsedColumn")}
                      </dt>
                      <dd>{formatDate(token.lastUsedAt)}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!adminMode &&
                    token.status === "ACTIVE" &&
                    !token.isExpired ? (
                      <Button
                        disabled={busyId !== null}
                        onClick={(event) =>
                          confirmAction(event.currentTarget, token, "renew")
                        }
                        type="button"
                        variant="default"
                      >
                        {sharedT("renew")}
                      </Button>
                    ) : null}
                    {token.status === "ACTIVE" && !token.isExpired ? (
                      <Button
                        disabled={busyId !== null}
                        onClick={(event) =>
                          confirmAction(event.currentTarget, token, "revoke")
                        }
                        type="button"
                        variant="default"
                      >
                        {sharedT("revoke")}
                      </Button>
                    ) : null}
                    <Button
                      disabled={busyId !== null}
                      onClick={(event) =>
                        confirmAction(event.currentTarget, token, "delete")
                      }
                      type="button"
                      variant="default"
                    >
                      {sharedT("delete")}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {loading ? (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            {sharedT("loading")}
          </p>
        ) : null}
      </section>

      <Modal
        opened={confirmation !== null}
        onClose={() => setConfirmation(null)}
        title={confirmation ? sharedT(confirmation.action) : undefined}
        transitionProps={{ duration: 0 }}
        withCloseButton={false}
      >
        {confirmation && (
          <>
            <p>{sharedT(`${confirmation.action}Confirm`)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                data-autofocus
                onClick={() => setConfirmation(null)}
                type="button"
                variant="default"
              >
                {sharedT("cancel")}
              </Button>
              <Button
                onClick={() =>
                  void runAction(confirmation.token, confirmation.action)
                }
                type="button"
              >
                {sharedT(confirmation.action)}
              </Button>
            </div>
          </>
        )}
      </Modal>
      <TokenValueDisplay
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setRenewedToken(null);
            restoreActionFocus();
          }
        }}
        open={Boolean(renewedToken)}
        token={renewedToken}
      />
    </>
  );
}
