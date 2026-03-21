"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBasePath } from "@/lib/base-path";

type ReviewActionsProps = {
  receiptId: string;
  mode: "review" | "respond" | "readonly";
};

export function ReviewActions({ receiptId, mode }: ReviewActionsProps) {
  const t = useTranslations("review");
  const { pushToast } = useToast();
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submitReview(status: "APPROVED" | "FLAGGED" | "REJECTED") {
    setSubmitting(true);
    const response = await fetch(withBasePath(`/api/receipts/${receiptId}/review`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, comment }),
    });
    const payload = (await response.json()) as { error?: string };
    setSubmitting(false);

    if (!response.ok) {
      pushToast(payload.error ?? t("couldNotSave"));
      return;
    }

    pushToast(t("reviewSaved"));
    window.location.reload();
  }

  async function submitComment() {
    setSubmitting(true);
    const response = await fetch(withBasePath(`/api/receipts/${receiptId}/comments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: comment }),
    });
    const payload = (await response.json()) as { error?: string };
    setSubmitting(false);

    if (!response.ok) {
      pushToast(payload.error ?? t("couldNotSave"));
      return;
    }

    pushToast(t("responseSaved"));
    window.location.reload();
  }

  async function uploadRevision(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(withBasePath(`/api/receipts/${receiptId}/revisions`), {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as { error?: string };
    setUploading(false);

    if (!response.ok) {
      pushToast(payload.error ?? t("couldNotSave"));
      return;
    }

    pushToast(t("responseSaved"));
    window.location.reload();
  }

  if (mode === "readonly") {
    return null;
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-[var(--panel)] p-4 dark:border-white/10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] opacity-55">
        {mode === "review" ? t("reviewReceipt") : t("respond")}
      </p>
      <textarea
        className="mt-4 min-h-28 w-full rounded-2xl border border-black/10 bg-transparent px-4 py-3 text-sm outline-none dark:border-white/10"
        onChange={(event) => setComment(event.target.value)}
        placeholder={t("commentPlaceholder")}
        value={comment}
      />

      {mode === "review" ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Button disabled={submitting} onClick={() => submitReview("APPROVED")} type="button">
            {t("approve")}
          </Button>
          <Button disabled={submitting} onClick={() => submitReview("FLAGGED")} type="button" variant="secondary">
            {t("flag")}
          </Button>
          <Button disabled={submitting} onClick={() => submitReview("REJECTED")} type="button" variant="secondary">
            {t("reject")}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Button disabled={submitting} onClick={submitComment} type="button">
            {t("submitComment")}
          </Button>
          <label className="block text-sm">
            {t("uploadRevision")}
            <input
              className="mt-2 block w-full text-sm"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void uploadRevision(file);
                }
              }}
              type="file"
            />
          </label>
        </div>
      )}
    </div>
  );
}
