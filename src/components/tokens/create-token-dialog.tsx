"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Modal,
  NativeSelect,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { withBasePath } from "@/lib/base-path";
import { useToast } from "@/components/ui/Toast";
import {
  TokenValueDisplay,
  type TokenValuePayload,
} from "@/components/tokens/token-value-display";

const EXPIRY_OPTIONS = [7, 30, 60, 90, 180, 365];

export function CreateTokenDialog({ defaultExpiry = 90 } = {}) {
  const router = useRouter();
  const t = useTranslations("tokens");
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(String(defaultExpiry));
  const [submitting, setSubmitting] = useState(false);
  const [createdToken, setCreatedToken] = useState<TokenValuePayload | null>(
    null,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const response = await fetch(withBasePath("/api/tokens"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          ...(Number(expiresInDays) === defaultExpiry
            ? {}
            : { expiresInDays: Number(expiresInDays) }),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        token?: {
          id: string;
          name: string;
          tokenValue: string;
          tokenPrefix: string;
          type: string;
          expiresAt: string | Date;
          createdAt: string | Date;
        };
      } | null;

      if (!response.ok || !payload?.token) {
        pushToast(payload?.error ?? t("createFailed"));
        return;
      }

      pushToast(t("created"));
      setCreatedToken({
        name: payload.token.name,
        tokenValue: payload.token.tokenValue,
      });
      window.dispatchEvent(
        new CustomEvent("tokens:created", {
          detail: {
            token: {
              id: payload.token.id,
              name: payload.token.name,
              tokenPrefix: payload.token.tokenPrefix,
              type: payload.token.type,
              status: "ACTIVE",
              expiresAt: payload.token.expiresAt,
              lastUsedAt: null,
              revokedAt: null,
              renewalCount: 0,
              createdAt: payload.token.createdAt,
              isExpired: false,
            },
          },
        }),
      );
      setOpen(false);
      setName("");
      setExpiresInDays(String(defaultExpiry));
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <UnstyledButton
        aria-label={t("create")}
        className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-left shadow-[0_18px_42px_-38px_var(--foreground)] transition hover:-translate-y-0.5"
        onClick={() => setOpen(true)}
        ref={trigger}
        type="button"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          {t("eyebrow")}
        </p>
        <h2 className="mt-3 text-2xl font-semibold">{t("title")}</h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {t("description")}
        </p>
        <span className="mt-5 inline-flex rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)]">
          {t("create")}
        </span>
      </UnstyledButton>
      <Modal
        onClose={() => setOpen(false)}
        opened={open}
        returnFocus={!createdToken}
        title={t("createTitle")}
        transitionProps={{ duration: 0 }}
        withCloseButton={false}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            void handleSubmit(event).catch(() => pushToast(t("createFailed")));
          }}
        >
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("createDescription")}
          </p>
          <TextInput
            data-autofocus
            id="token-name"
            label={t("nameLabel")}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("namePlaceholder")}
            required
            value={name}
            withAsterisk={false}
          />
          <NativeSelect
            label={t("expiryLabel")}
            onChange={(event) => setExpiresInDays(event.currentTarget.value)}
            value={expiresInDays}
            data={[...new Set([...EXPIRY_OPTIONS, defaultExpiry])]
              .sort((a, b) => a - b)
              .map((value) => ({
                value: String(value),
                label: EXPIRY_OPTIONS.includes(value)
                  ? t(`expiryOptions.${value}`)
                  : String(value),
              }))}
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="default"
            >
              {t("cancel")}
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? t("creating") : t("create")}
            </Button>
          </div>
        </form>
      </Modal>

      <TokenValueDisplay
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setCreatedToken(null);
            requestAnimationFrame(() => trigger.current?.focus());
          }
        }}
        open={Boolean(createdToken)}
        token={createdToken}
      />
    </>
  );
}
