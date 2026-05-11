import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth";
import { TeamsIntegrationPanel } from "@/components/teams/TeamsIntegrationPanel";
import {
  getIntegrationStatus,
  listDeliveryTargets,
  listIntakeSubscriptions,
} from "@/services/teams/admin";
import { getTeamsDelegatedGrantStatus } from "@/services/teams/consent";
import { Role } from "../../../../../../generated/prisma/enums";

export default async function AdminTeamsIntegrationsPage() {
  const user = await requireSession();
  const t = await getTranslations("teams");

  if (user.role !== Role.PLATFORM_ADMIN) {
    redirect("/dashboard");
  }

  const [status, targets, subscriptions, consentStatus] = await Promise.all([
    getIntegrationStatus(),
    listDeliveryTargets(),
    listIntakeSubscriptions(),
    getTeamsDelegatedGrantStatus(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] opacity-45">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm opacity-70 sm:text-base">
          {t("description")}
        </p>
      </div>
      <TeamsIntegrationPanel
        initialConfig={status}
        initialTargets={targets}
        initialSubscriptions={subscriptions}
        initialConsentStatus={consentStatus}
      />
    </div>
  );
}
