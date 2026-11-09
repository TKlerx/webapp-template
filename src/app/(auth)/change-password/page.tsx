import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthMethod } from "../../../../generated/prisma/enums";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { requireSession } from "@/lib/auth";

export default async function ChangePasswordPage() {
  const user = await requireSession();
  if (user.authMethod === AuthMethod.SSO) redirect("/dashboard");
  const t = await getTranslations();

  return (
    <AuthPageShell
      description={t(
        user.mustChangePassword
          ? "auth.changePasswordDescription"
          : "auth.changeExistingPasswordDescription",
      )}
      eyebrow={t(
        user.mustChangePassword ? "auth.firstLogin" : "auth.localAccount",
      )}
      title={t("auth.changePassword")}
    >
      <ChangePasswordForm />
      {!user.mustChangePassword && (
        <Link
          className="mt-4 inline-flex min-h-11 items-center text-sm underline"
          href="/dashboard"
        >
          {t("common.cancel")}
        </Link>
      )}
    </AuthPageShell>
  );
}
