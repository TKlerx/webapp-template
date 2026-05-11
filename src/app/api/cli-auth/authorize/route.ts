import { NextResponse } from "next/server";
import { getAbsoluteAppUrl } from "@/lib/better-auth-route";
import { jsonError } from "@/lib/http";
import { createAuthCode, isValidCliCallbackUrl } from "@/services/api/cli-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const callbackUrl = url.searchParams.get("callback_url");
  const state = url.searchParams.get("state");

  if (!callbackUrl || !isValidCliCallbackUrl(callbackUrl)) {
    return jsonError(
      "callback_url must target http://localhost or http://127.0.0.1",
      400,
    );
  }

  if (!state?.trim()) {
    return jsonError("state is required", 400);
  }

  const authCode = await createAuthCode(callbackUrl, state);
  const redirectTarget = `/login?redirectTo=${encodeURIComponent(`/cli-login?request=${authCode.id}`)}`;

  return NextResponse.redirect(getAbsoluteAppUrl(redirectTarget));
}
