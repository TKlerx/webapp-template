import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth";
import { Role } from "../../../../generated/prisma/enums";
import { AuditTrailViewer } from "@/components/audit/AuditTrailViewer";

export default async function AuditTrailPage() {
  const user = await requireSession();
  const t = await getTranslations("audit");

  if (user.role !== Role.PLATFORM_ADMIN) {
    return <p className="text-sm opacity-70">Not authorized.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] opacity-45">
          {t("title")}
        </p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-4xl">
          {t("title")}
        </h1>
      </div>
      <AuditTrailViewer />
    </div>
  );
}
