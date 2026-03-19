import { Navigation } from "@/components/ui/Navigation";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { requireSession } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { getLocale, getTranslations } from "next-intl/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  const t = await getTranslations("common");
  const locale = await getLocale();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] opacity-45">
            {t("appName")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Navigation user={user} />
          <LocaleSwitcher currentLocale={locale} />
          <ThemeToggle user={user} />
          <form action={withBasePath("/api/auth/logout")} method="post">
            <Button type="submit" variant="secondary">
              {t("signOut")}
            </Button>
          </form>
        </div>
      </header>
      <div className="mt-8 sm:mt-10">{children}</div>
    </main>
  );
}
