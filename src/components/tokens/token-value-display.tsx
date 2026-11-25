"use client";

import { useTranslations } from "next-intl";
import { Button, Modal } from "@mantine/core";
import { useToast } from "@/components/ui/Toast";

export type TokenValuePayload = {
  name: string;
  tokenValue: string;
};

export function TokenValueDisplay({
  open,
  onOpenChange,
  token,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: TokenValuePayload | null;
}) {
  const t = useTranslations("tokens");
  const { pushToast } = useToast();

  if (!token) {
    return null;
  }

  const currentToken = token;

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(currentToken.tokenValue);
      pushToast(t("copied"));
    } catch {
      pushToast(t("copyFailed"));
    }
  }

  return (
    <Modal
      opened={open}
      onClose={() => onOpenChange(false)}
      title={t("tokenValueTitle", { name: currentToken.name })}
      withCloseButton={false}
    >
      <div className="grid gap-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("tokenValueWarning")}
        </p>
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[color:color-mix(in_srgb,var(--panel)_86%,var(--background)_14%)] p-4 font-mono text-sm break-all">
          {currentToken.tokenValue}
        </div>
        <div className="flex justify-end gap-2">
          <Button data-autofocus onClick={() => void copyToken()} type="button">
            {t("copy")}
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="default"
          >
            {t("done")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
