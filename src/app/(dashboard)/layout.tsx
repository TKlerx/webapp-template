import { UserMenu } from "@/components/ui/UserMenu";
import { requireSession } from "@/lib/auth";
import { getLocale } from "next-intl/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  const locale = await getLocale();

  return (
    <div className="relative min-h-[100dvh]">
      <div className="fixed right-4 top-3 z-50">
        <UserMenu user={user} locale={locale} />
      </div>
      {children}
    </div>
  );
}
