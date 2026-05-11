import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const user = await requireSession();
  const t = await getTranslations("dashboard");

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <div>
      <p className="text-sm uppercase tracking-[0.2em] opacity-45">
        {t("label")}
      </p>
      <h1 className="mt-3 text-2xl font-semibold sm:text-4xl">
        {t("welcomeBack", { name: user.name })}
      </h1>

      <section className="mt-8 grid gap-4 sm:mt-10 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-black/10 bg-[var(--panel)] p-5 sm:p-6 dark:border-white/10">
          <p className="text-sm uppercase tracking-[0.2em] opacity-45">
            {t("role")}
          </p>
          <p className="mt-3 text-xl font-semibold sm:mt-4 sm:text-2xl">
            {user.role}
          </p>
        </article>
        <article className="rounded-2xl border border-black/10 bg-[var(--panel)] p-5 sm:p-6 dark:border-white/10">
          <p className="text-sm uppercase tracking-[0.2em] opacity-45">
            {t("status")}
          </p>
          <p className="mt-3 text-xl font-semibold sm:mt-4 sm:text-2xl">
            {user.status}
          </p>
        </article>
        <article className="rounded-2xl border border-black/10 bg-[var(--panel)] p-5 sm:p-6 dark:border-white/10">
          <p className="text-sm uppercase tracking-[0.2em] opacity-45">
            {t("theme")}
          </p>
          <p className="mt-3 text-xl font-semibold sm:mt-4 sm:text-2xl">
            {user.themePreference}
          </p>
        </article>
        <article className="rounded-2xl border border-black/10 bg-[var(--panel)] p-5 sm:p-6 dark:border-white/10">
          <p className="text-sm uppercase tracking-[0.2em] opacity-45">
            {t("email")}
          </p>
          <p className="mt-3 break-all text-xl font-semibold sm:mt-4 sm:text-2xl">
            {user.email}
          </p>
        </article>
      </section>
    </div>
  );
}
