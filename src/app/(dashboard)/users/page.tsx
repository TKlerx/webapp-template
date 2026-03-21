import { Role } from "../../../../generated/prisma/enums";
import { CreateUserDialog } from "@/components/auth/CreateUserDialog";
import { UserManagementTable } from "@/components/auth/UserManagementTable";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";

export default async function UsersPage() {
  const user = await requireSession();
  const t = await getTranslations("users");

  if (user.role !== Role.PLATFORM_ADMIN) {
    return <div className="text-lg font-medium">{t("notAuthorized")}</div>;
  }

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <CreateUserDialog />
      <section className="rounded-2xl border border-black/10 bg-[var(--panel)] p-4 sm:p-6 dark:border-white/10">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <UserManagementTable currentUserId={user.id} users={users} />
      </section>
    </div>
  );
}
