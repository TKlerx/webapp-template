import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthMethod } from "../../../../generated/prisma/enums";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import "@mantine/core/styles/Input.layer.css";
import { requireSession } from "@/lib/auth";
import { passwordChangeReturnPath } from "@/lib/local-redirect";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const user = await requireSession({ allowRequiredPasswordChange: true });
  if (user.authMethod === AuthMethod.SSO) redirect("/dashboard");
  const t = await getTranslations();
  const { returnTo } = await searchParams;
  const destination =
    (typeof returnTo === "string" && passwordChangeReturnPath(returnTo)) ||
    "/dashboard";

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
      <ChangePasswordForm destination={destination} />
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
