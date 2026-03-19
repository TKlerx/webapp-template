"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Form } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { withBasePath } from "@/lib/base-path";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setLoginError(null);

    try {
      const response = await fetch(withBasePath("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as { error?: string; redirectTo?: string };

      setLoading(false);

      if (!response.ok) {
        const errorMessage = payload.error ?? t("loginFailed");
        setLoginError(errorMessage);
        pushToast(errorMessage);
        return;
      }

      router.push(payload.redirectTo ?? "/dashboard");
    } catch {
      setLoading(false);
      setLoginError(t("loginFailed"));
      pushToast(t("loginFailed"));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="rounded-2xl border border-black/10 bg-[var(--panel)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.08)] sm:p-8 dark:border-white/10">
        <p className="text-sm uppercase tracking-[0.2em] opacity-50">{tCommon("appName")}</p>
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">{t("signIn")}</h1>
        <p className="mt-3 text-sm opacity-65">
          {t("description")}
        </p>

        {searchParams.get("error") ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {searchParams.get("error") === "revoked"
              ? t("ssoRevoked")
              : searchParams.get("error") === "sso-config"
                ? t("ssoNotConfigured")
                : t("authFailed")}
          </div>
        ) : null}

        {loginError ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {loginError}
          </div>
        ) : null}

        <div className="mt-6">
          <a href={withBasePath("/api/auth/sso/azure")}>
            <Button className="w-full" type="button">
              {t("signInAzure")}
            </Button>
          </a>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] opacity-35">
          <span className="h-px flex-1 bg-current" />
          <span>{t("localAccount")}</span>
          <span className="h-px flex-1 bg-current" />
        </div>

        <Form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            {t("email")}
            <Input
              className="mt-2"
              type="email"
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
          </label>
          <label className="block text-sm font-medium">
            {t("password")}
            <Input
              className="mt-2"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (loginError) {
                  setLoginError(null);
                }
              }}
              required
            />
          </label>
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? t("signingIn") : t("signIn")}
          </Button>
        </Form>
      </div>
    </main>
  );
}
