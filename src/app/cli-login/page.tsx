import { CliLoginRedirect } from "@/components/auth/cli-login-redirect";
import { requireSession } from "@/lib/auth";
import { bindAuthCodeToUser } from "@/services/api/cli-auth";

export default async function CliLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const user = await requireSession();
  const { request } = await searchParams;

  if (!request) {
    return <CliLoginRedirect success={false} />;
  }

  const result = await bindAuthCodeToUser(request, user.id);
  if ("error" in result) {
    return <CliLoginRedirect success={false} />;
  }

  const redirectUrl = new URL(result.authCode.callbackUrl);
  redirectUrl.searchParams.set("code", result.authCode.code);
  redirectUrl.searchParams.set("state", result.authCode.state);

  return <CliLoginRedirect redirectUrl={redirectUrl.toString()} success />;
}
