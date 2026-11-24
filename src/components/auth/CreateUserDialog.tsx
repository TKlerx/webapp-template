"use client";

import { Button, Card, Modal, Select, TextInput } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Role } from "../../../generated/prisma/enums";
import { useToast } from "@/components/ui/Toast";
import { withBasePath } from "@/lib/base-path";
import { apiErrorSchema } from "@/lib/api-response";

const initialForm: {
  email: string;
  name: string;
  role: Role;
  temporaryPassword: string;
} = {
  email: "",
  name: "",
  role: Role.SCOPE_USER,
  temporaryPassword: "",
};

const inputClassNames = {
  input: "border-border bg-panel text-foreground",
};

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pushToast } = useToast();
  const router = useRouter();
  const t = useTranslations("users");
  const tCommon = useTranslations("common");

  function closeForm() {
    setOpen(false);
    setForm(initialForm);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(withBasePath("/api/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const payload = apiErrorSchema.safeParse(
          await response.json().catch(() => null),
        );
        setError(
          (payload.success ? payload.data.error : undefined) ??
            t("couldNotCreate"),
        );
        return;
      }

      pushToast(t("userCreated"));
      closeForm();
      router.refresh();
    } catch {
      setError(t("couldNotCreate"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card
        withBorder
        className="gap-4 rounded-lg border-border bg-panel p-4 text-panel-foreground sm:p-6"
      >
        <h2 className="text-lg font-semibold tracking-tight">
          {t("createUser")}
        </h2>
        <div>
          <Button
            type="button"
            aria-haspopup="dialog"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => setOpen(true)}
          >
            {t("createButton")}
          </Button>
        </div>
      </Card>

      <Modal
        opened={open}
        onClose={closeForm}
        title={t("createUser")}
        centered
        size="lg"
        closeButtonProps={{
          "aria-label": tCommon("close"),
          disabled: submitting,
        }}
        closeOnClickOutside={!submitting}
        closeOnEscape={!submitting}
        classNames={{
          content: "rounded-lg bg-panel text-panel-foreground",
          header: "bg-panel",
          title: "text-lg font-semibold tracking-tight",
        }}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <TextInput
            label={t("email")}
            type="email"
            autoComplete="off"
            data-autofocus
            classNames={inputClassNames}
            value={form.email}
            onChange={(event) => {
              const email = event.currentTarget.value;
              setForm((current) => ({ ...current, email }));
            }}
            required
          />
          <TextInput
            label={t("name")}
            classNames={inputClassNames}
            value={form.name}
            onChange={(event) => {
              const name = event.currentTarget.value;
              setForm((current) => ({ ...current, name }));
            }}
            required
          />
          <Select<Role>
            label={t("role")}
            allowDeselect={false}
            withScrollArea={false}
            classNames={{
              ...inputClassNames,
              dropdown: "border-border bg-popover text-popover-foreground",
            }}
            data={Object.values(Role).map((role) => ({
              value: role,
              label: t(`roles.${role}`),
            }))}
            value={form.role}
            onChange={(role) => {
              if (role) setForm((current) => ({ ...current, role }));
            }}
          />
          <TextInput
            label={t("temporaryPassword")}
            type="password"
            autoComplete="new-password"
            classNames={inputClassNames}
            value={form.temporaryPassword}
            onChange={(event) => {
              const temporaryPassword = event.currentTarget.value;
              setForm((current) => ({ ...current, temporaryPassword }));
            }}
            required
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="default"
              disabled={submitting}
              onClick={closeForm}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              loading={submitting}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {t("createButton")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
