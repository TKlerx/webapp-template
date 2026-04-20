import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { NotificationAdminPanel } from "@/components/notifications/NotificationAdminPanel";
import { requireSession } from "@/lib/auth";
import {
  listNotificationLog,
  listNotificationTypeConfigurations,
} from "@/services/notifications/admin";
import { Role } from "../../../../../generated/prisma/enums";

export default async function AdminNotificationsPage() {
  const user = await requireSession();
  const t = await getTranslations("notifications");

  if (user.role !== Role.PLATFORM_ADMIN) {
    redirect("/dashboard");
  }

  const [configs, notifications] = await Promise.all([
    listNotificationTypeConfigurations(),
    listNotificationLog(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] opacity-45">{t("eyebrow")}</p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm opacity-70 sm:text-base">{t("description")}</p>
      </div>
      <NotificationAdminPanel initialConfigs={configs} initialNotifications={notifications} />
    </div>
  );
}
