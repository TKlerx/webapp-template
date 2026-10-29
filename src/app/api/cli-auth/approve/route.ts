import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getScopedCookiePath } from "@/lib/azure-auth";
import { getAbsoluteAppUrl } from "@/lib/better-auth-route";
import { jsonError } from "@/lib/http";
import { requireApiUser } from "@/lib/route-auth";
import { parseFormBody } from "@/lib/validation";
import { z } from "zod";
import {
  CLI_AUTH_CSRF_COOKIE,
  bindAuthCodeToUser,
} from "@/services/api/cli-auth";

const approvalBodySchema = z
  .object({
    request: z.string().min(1),
    csrfToken: z.string().min(1),
  })
  .strict();

function redirectToCliLogin() {
  return NextResponse.redirect(getAbsoluteAppUrl("/cli-login?error=1"));
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if ("error" in auth) {
    return auth.error;
  }

  const parsed = await parseFormBody(request, approvalBodySchema);
  if ("error" in parsed) return parsed.error;
  const { request: requestId, csrfToken } = parsed.data;

  const cookieStore = await cookies();
  const expectedCsrfToken = cookieStore.get(CLI_AUTH_CSRF_COOKIE)?.value;
  cookieStore.delete({
    name: CLI_AUTH_CSRF_COOKIE,
    path: getScopedCookiePath(),
  });

  if (!expectedCsrfToken || expectedCsrfToken !== csrfToken) {
    return jsonError("Invalid CLI approval request", 403);
  }

  const result = await bindAuthCodeToUser(requestId, auth.user.id);
  if ("error" in result) {
    return redirectToCliLogin();
  }

  const redirectUrl = new URL(result.authCode.callbackUrl);
  redirectUrl.searchParams.set("code", result.authCode.code);
  redirectUrl.searchParams.set("state", result.authCode.state);
  return NextResponse.redirect(redirectUrl);
}
