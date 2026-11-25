"use client";

import { Button, TextInput } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Form } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { withBasePath } from "@/lib/base-path";

export function ChangePasswordForm({ destination = "/dashboard" } = {}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const { pushToast } = useToast();
  const t = useTranslations("auth");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch(withBasePath("/api/auth/change-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const payload = (await response.json()) as { error?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? t("couldNotUpdatePassword"));
      return;
    }

    pushToast(t("passwordChanged"));
    window.location.assign(withBasePath(destination));
  }

  return (
    <Form
      className="mt-8"
      onSubmit={(event) => {
        void handleSubmit(event).catch(() => {
          setSubmitting(false);
          setError(t("couldNotUpdatePassword"));
        });
      }}
    >
      {error && (
        <div
          className="rounded-lg border border-[var(--destructive)] p-3 text-sm text-[var(--destructive)]"
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {error}
        </div>
      )}
      <TextInput
        label={t("currentPassword")}
        name="currentPassword"
        size="md"
        withAsterisk={false}
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        required
      />
      <TextInput
        label={t("newPassword")}
        name="newPassword"
        size="md"
        withAsterisk={false}
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        required
      />
      <Button disabled={submitting} fullWidth size="md" type="submit">
        {submitting ? t("saving") : t("saveNewPassword")}
      </Button>
    </Form>
  );
}
