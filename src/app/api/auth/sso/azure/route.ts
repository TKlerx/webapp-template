import { NextResponse } from "next/server";
import { AuthMethod, Role, ThemePreference, UserStatus } from "../../../../../../generated/prisma/enums";
import { auth } from "@/lib/better-auth";
import { applySetCookieHeaders } from "@/lib/better-auth-http";
import { getAbsoluteAppUrl } from "@/lib/better-auth-route";
import { hasRealAzureAdConfig } from "@/lib/azure-auth";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

function redirectTo(request: Request, target: string) {
  const basePath = process.env.BASE_PATH ?? "";
  return NextResponse.redirect(new URL(`${basePath}${target}`, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mockEmail = url.searchParams.get("email");
  const mockName = url.searchParams.get("name");

  if (process.env.E2E_MOCK_SSO === "1" && mockEmail) {
    const email = mockEmail.toLowerCase();
    const name = mockName?.trim() || email;
    const mockPassword = `MockSsoPass1!:${email}`;
    const passwordHash = await hashPassword(mockPassword);
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    const authMethod =
      existingUser?.authMethod === AuthMethod.LOCAL
        ? AuthMethod.BOTH
        : existingUser?.authMethod ?? AuthMethod.SSO;

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        emailVerified: true,
        authMethod,
        mustChangePassword: false,
        passwordHash,
      },
      create: {
        email,
        emailVerified: true,
        name,
        role: Role.SCOPE_USER,
        status: UserStatus.PENDING_APPROVAL,
        authMethod: AuthMethod.SSO,
        mustChangePassword: false,
        themePreference: ThemePreference.LIGHT,
        locale: "en",
        passwordHash,
      },
    });

    await prisma.account.upsert({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: email,
        },
      },
      update: {
        userId: user.id,
        password: passwordHash,
      },
      create: {
        userId: user.id,
        providerId: "credential",
        accountId: email,
        password: passwordHash,
      },
    });

    const redirectTarget =
      user.status === UserStatus.PENDING_APPROVAL ? "/pending" : "/dashboard";

    const authResponse = await auth.api.signInEmail({
      body: {
        email,
        password: mockPassword,
      },
      headers: new Headers(request.headers),
      asResponse: true,
    });

    if (!authResponse.ok) {
      return redirectTo(request, "/login?error=sso-mock-failed");
    }

    return applySetCookieHeaders(redirectTo(request, redirectTarget), authResponse);
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
