"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { locales, type Locale } from "@/i18n/config";
import { withBasePath } from "@/lib/base-path";

const localeLabels: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  pt: "Português",
};

export function LocaleSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const newLocale = event.target.value;
    startTransition(async () => {
      await fetch(withBasePath("/api/locale"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: newLocale }),
      });
      router.refresh();
    });
  }

  return (
    <select
      className="min-w-32 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium shadow-sm dark:border-white/10 dark:bg-white/10"
      disabled={isPending}
      value={currentLocale}
      onChange={handleChange}
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeLabels[locale]}
        </option>
      ))}
    </select>
  );
}
