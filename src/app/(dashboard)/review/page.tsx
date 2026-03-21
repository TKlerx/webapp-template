import { requireSession } from "@/lib/auth";
import { ReviewDashboard } from "@/components/review/ReviewDashboard";
import { getTranslations } from "next-intl/server";

export default async function ReviewPage() {
  await requireSession();
  const t = await getTranslations("review");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] opacity-45">{t("title")}</p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-4xl">{t("reviewReceipt")}</h1>
      </div>
      <ReviewDashboard />
    </div>
  );
}
