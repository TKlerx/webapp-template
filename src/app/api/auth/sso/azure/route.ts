import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { applySetCookieHeaders } from "@/lib/better-auth-http";
import { getAbsoluteAppUrl } from "@/lib/better-auth-route";
import { createSessionRedirect, provisionSsoUser } from "@/lib/auth";
import { hasRealAzureAdConfig } from "@/lib/azure-auth";
import { UserStatus } from "../../../../../../generated/prisma/enums";

function redirectTo(request: Request, target: string) {
  const basePath = process.env.BASE_PATH ?? "";
  return NextResponse.redirect(new URL(`${basePath}${target}`, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const name = url.searchParams.get("name") ?? "SSO User";

  if (email) {
    const user = await provisionSsoUser({ email, name });

    if (user.status === UserStatus.ACTIVE) {
      return createSessionRedirect(redirectTo(request, "/dashboard"), user.id);
    }

    return redirectTo(request, "/pending");
  }

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
