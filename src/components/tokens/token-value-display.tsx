"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
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
    await navigator.clipboard.writeText(currentToken.tokenValue);
    pushToast(t("copied"));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2rem] border-black/10 bg-[var(--panel)] p-6 dark:border-white/10">
        <DialogHeader>
          <DialogTitle>
            {t("tokenValueTitle", { name: currentToken.name })}
          </DialogTitle>
          <DialogDescription>{t("tokenValueWarning")}</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-dashed border-black/15 bg-black/5 p-4 font-mono text-sm break-all dark:border-white/15 dark:bg-white/5">
          {currentToken.tokenValue}
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={() => void copyToken()} type="button">
            {t("copy")}
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="secondary"
          >
            {t("done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
