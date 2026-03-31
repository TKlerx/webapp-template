import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/db";
import { applySetCookieHeaders } from "@/lib/better-auth-http";
import { jsonError } from "@/lib/http";
import { AuthMethod, UserStatus } from "../../../../../generated/prisma/enums";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  if (!body.email || !body.password) {
    return jsonError("Email and password are required", 400);
  }

  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
  });
  const email = body.email.toLowerCase();

  if (!user || !user.passwordHash) {
    return jsonError("Invalid email or password", 401);
  }

  if (user.status === UserStatus.INACTIVE) {
    return jsonError("Your account has been deactivated. Contact an administrator.", 403);
  }

  const authResponse = await auth.api.signInEmail({
    body: {
      email,
      password: body.password,
    },
    headers: new Headers(request.headers),
    asResponse: true,
  });

  if (!authResponse.ok) {
    return jsonError("Invalid email or password", 401);
  }

  const authMethod =
    user.authMethod === AuthMethod.SSO ? AuthMethod.BOTH : user.authMethod;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      authMethod,
    },
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
    mustChangePassword: user.mustChangePassword,
    redirectTo: user.mustChangePassword ? "/change-password" : "/dashboard",
  });

  return applySetCookieHeaders(response, authResponse);
}
