"use client";

import { useSearchParams } from "next/navigation";
import { Button, TextInput } from "@mantine/core";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Form } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { withBasePath } from "@/lib/base-path";

const emptySubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (loginError) errorRef.current?.focus();
  }, [loginError]);
  const formReady = useSyncExternalStore(
    emptySubscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const t = useTranslations("auth");
  const redirectTo = searchParams.get("redirectTo");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setLoginError(null);

    try {
      const response = await fetch(withBasePath("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, redirectTo }),
      });

      const payload = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };

      setLoading(false);

      if (!response.ok) {
        const errorMessage = payload.error ?? t("loginFailed");
        setLoginError(errorMessage);
        pushToast(errorMessage);
        return;
      }

      window.location.assign(withBasePath(payload.redirectTo ?? "/dashboard"));
    } catch {
      setLoading(false);
      setLoginError(t("loginFailed"));
      pushToast(t("loginFailed"));
    }
  }

  return (
    <>
      {searchParams.get("error") ? (
        <div
          className="rounded-xl border border-[color:color-mix(in_srgb,var(--destructive)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--destructive)_10%,var(--panel))] px-4 py-3 text-sm text-[var(--destructive)]"
          role="alert"
        >
          {searchParams.get("error") === "revoked"
            ? t("ssoRevoked")
            : searchParams.get("error") === "sso-config"
              ? t("ssoNotConfigured")
              : t("authFailed")}
        </div>
      ) : null}

      {loginError ? (
        <div
          className="rounded-xl border border-[color:color-mix(in_srgb,var(--destructive)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--destructive)_10%,var(--panel))] px-4 py-3 text-sm text-[var(--destructive)]"
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {loginError}
        </div>
      ) : null}

      <div className="mt-1">
        <Button
          component="a"
          fullWidth
          size="md"
          href={withBasePath(
            redirectTo
              ? `/api/auth/sso/azure?redirectTo=${encodeURIComponent(redirectTo)}`
              : "/api/auth/sso/azure",
          )}
        >
          {t("signInAzure")}
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
        <span className="h-px flex-1 bg-current" />
        <span>{t("localAccount")}</span>
        <span className="h-px flex-1 bg-current" />
      </div>

      {formReady ? (
        <Form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <TextInput
            id="login-email"
            label={t("email")}
            size="md"
            withAsterisk={false}
            type="email"
            name="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            suppressHydrationWarning
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (loginError) {
                setLoginError(null);
              }
            }}
            placeholder="admin@example.com"
            required
          />
          <TextInput
            id="login-password"
            label={t("password")}
            size="md"
            withAsterisk={false}
            type="password"
            name="password"
            autoComplete="current-password"
            suppressHydrationWarning
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (loginError) {
                setLoginError(null);
              }
            }}
            required
          />
          <Button disabled={loading} fullWidth size="md" type="submit">
            {loading ? t("signingIn") : t("signIn")}
          </Button>
        </Form>
      ) : (
        <div aria-hidden="true" className="space-y-4">
          <div>
            <div className="h-5 w-14 rounded bg-[color:color-mix(in_srgb,var(--muted-foreground)_18%,transparent)]" />
            <div className="mt-2 h-11 rounded-lg border border-[var(--border)] bg-[var(--panel)]" />
          </div>
          <div>
            <div className="h-5 w-20 rounded bg-[color:color-mix(in_srgb,var(--muted-foreground)_18%,transparent)]" />
            <div className="mt-2 h-11 rounded-lg border border-[var(--border)] bg-[var(--panel)]" />
          </div>
          <div className="h-11 rounded-lg bg-[color:color-mix(in_srgb,var(--primary)_34%,var(--panel))]" />
        </div>
      )}
    </>
  );
}
