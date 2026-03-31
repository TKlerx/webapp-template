import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { applySetCookieHeaders } from "@/lib/better-auth-http";
import { getAbsoluteAppUrl } from "@/lib/better-auth-route";
import { hasRealAzureAdConfig } from "@/lib/azure-auth";

function redirectTo(request: Request, target: string) {
  const basePath = process.env.BASE_PATH ?? "";
  return NextResponse.redirect(new URL(`${basePath}${target}`, request.url));
}

export async function GET(request: Request) {
  if (!hasRealAzureAdConfig()) {
    return redirectTo(request, "/login?error=sso-config");
  }

  const authResponse = await auth.api.signInSocial({
    body: {
      provider: "microsoft",
      callbackURL: getAbsoluteAppUrl("/dashboard"),
    },
    headers: new Headers(request.headers),
    asResponse: true,
  });

  const location = authResponse.headers.get("location");
  if (location) {
    return applySetCookieHeaders(NextResponse.redirect(location), authResponse);
  }

  return authResponse;
}

export const POST = GET;
