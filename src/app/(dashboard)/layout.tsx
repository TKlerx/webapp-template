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
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="sticky top-4 z-20 rounded-[2rem] border border-black/10 bg-[var(--panel)] px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:px-6 dark:border-white/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] opacity-45">
              {t("appName")}
            </p>
            <p className="mt-2 truncate text-lg font-semibold sm:text-xl">
              {user.name}
            </p>
            <p className="text-sm opacity-65">{user.email}</p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <Navigation user={user} />
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <LocaleSwitcher currentLocale={locale} />
              <ThemeToggle user={user} />
              <form action={withBasePath("/api/auth/logout")} method="post">
                <Button className="font-bold" type="submit" variant="secondary">
                  {t("signOut")}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <div className="mt-8 sm:mt-10">{children}</div>
    </main>
  );
}
