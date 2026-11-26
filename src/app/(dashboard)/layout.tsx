import { DashboardSidebar } from "@/components/ui/DashboardSidebar";
import { UserMenu } from "@/components/ui/UserMenu";
import { requireSession } from "@/lib/auth";
import { getLocale } from "next-intl/server";
import { Assistant } from "@/components/assistant/Assistant";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  const locale = await getLocale();

  return (
    <div className="relative min-h-[100dvh] md:pl-64">
      <DashboardSidebar />
      <div className="flex items-center justify-end gap-2 px-4 py-3 md:contents">
        <Assistant key={user.id} userId={user.id} />
        <div className="md:fixed md:top-3 md:right-4 md:z-50">
          <UserMenu user={user} locale={locale} />
        </div>
      </div>
      <main className="min-h-[100dvh]">{children}</main>
    </div>
  );
}
