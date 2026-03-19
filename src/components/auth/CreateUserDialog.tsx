"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Role } from "../../../generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { Form } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { withBasePath } from "@/lib/base-path";

export function CreateUserDialog() {
  const [form, setForm] = useState<{
    email: string;
    name: string;
    role: Role;
    temporaryPassword: string;
  }>({
    email: "",
    name: "",
    role: Role.MARKETER,
    temporaryPassword: "",
  });
  const { pushToast } = useToast();
  const router = useRouter();
  const t = useTranslations("users");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(withBasePath("/api/users"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json();
    if (!response.ok) {
      pushToast(payload.error ?? t("couldNotCreate"));
      return;
    }
    pushToast(t("userCreated"));
    setForm({ email: "", name: "", role: Role.MARKETER, temporaryPassword: "" });
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-[var(--panel)] p-4 sm:p-6 dark:border-white/10">
      <h2 className="text-xl font-semibold">{t("createUser")}</h2>
      <Form className="mt-4" onSubmit={handleSubmit}>
        <Input
          placeholder={t("emailPlaceholder")}
          type="email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          required
        />
        <Input
          placeholder={t("namePlaceholder")}
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
        />
        <select
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-[var(--panel)]"
          value={form.role}
          onChange={(event) =>
            setForm((current) => ({ ...current, role: event.target.value as Role }))
          }
        >
          {Object.values(Role).map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role}`)}
            </option>
          ))}
        </select>
        <Input
          placeholder={t("temporaryPassword")}
          type="password"
          value={form.temporaryPassword}
          onChange={(event) =>
            setForm((current) => ({ ...current, temporaryPassword: event.target.value }))
          }
          required
        />
        <Button type="submit">{t("createButton")}</Button>
      </Form>
    </div>
  );
}
