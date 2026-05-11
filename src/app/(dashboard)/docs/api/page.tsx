import { SwaggerUi } from "@/components/docs/swagger-ui";
import { requireSession } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

export default async function ApiDocsPage() {
  await requireSession();
  const t = await getTranslations("apiDocs");

  return (
    <section className="grid gap-6">
      <div className="rounded-[2rem] border border-black/10 bg-[var(--panel)] p-6 dark:border-white/10">
        <p className="text-xs uppercase tracking-[0.28em] opacity-45">
          OpenAPI
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm opacity-75">{t("description")}</p>
      </div>
      <SwaggerUi />
    </section>
  );
}
