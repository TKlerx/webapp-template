"use client";

import { Button } from "@heroui/react";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import type { SessionUser } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/ui/Toast";

type Theme = "LIGHT" | "DARK";

export function ThemeToggle({ user }: { user: SessionUser }) {
  const { theme, setTheme } = useTheme();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("common");
  const tTheme = useTranslations("theme");

  const nextTheme: Theme = theme === "LIGHT" ? "DARK" : "LIGHT";

  const updateTheme = async (nextValue: Theme, currentUser: SessionUser) => {
    const response = await fetch(
      withBasePath(`/api/users/${currentUser.id}/theme`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ themePreference: nextValue }),
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(payload?.error ?? "Failed to update theme");
    }

    pushToast(
      tTheme("switchedTo", { theme: nextValue === "DARK" ? "dark" : "light" }),
    );
  };

  return (
    <Button
      className="shadow-sm"
      isDisabled={isPending}
      onPress={() => {
        const previousTheme = theme;
        setTheme(nextTheme);
        startTransition(async () => {
          try {
            await updateTheme(nextTheme, user);
          } catch (error) {
            setTheme(previousTheme);
            pushToast(
              error instanceof Error ? error.message : "Failed to update theme",
            );
          }
        });
      }}
      type="button"
      variant="outline"
    >
      {isPending
        ? t("saving")
        : nextTheme === "DARK"
          ? t("darkMode")
          : t("lightMode")}
    </Button>
  );
}
