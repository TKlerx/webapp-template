import { NextResponse } from "next/server";
import { safeLogAudit } from "@/lib/audit";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/db";
import { applySetCookieHeaders } from "@/lib/better-auth-http";
import { jsonError } from "@/lib/http";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { AuditAction, AuthMethod, UserStatus } from "../../../../../generated/prisma/enums";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(getClientIp(request), "login");
  if (!rateLimit.allowed) {
    const response = jsonError("Too many login attempts. Please try again later.", 429);
    response.headers.set("Retry-After", Math.ceil(rateLimit.retryAfterMs / 1000).toString());
    return response;
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  if (!body.email || !body.password) {
    return jsonError("Email and password are required", 400);
  }

  const email = body.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return jsonError("Invalid email or password", 401);
  }

  if (user.status === UserStatus.INACTIVE) {
    await safeLogAudit({
      action: AuditAction.AUTH_LOGIN_REJECTED,
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      details: {
        reason: "inactive_account",
      },
    });
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
    await safeLogAudit({
      action: AuditAction.AUTH_LOGIN_REJECTED,
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      details: {
        reason: "invalid_credentials",
      },
    });
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

  await safeLogAudit({
    action: AuditAction.AUTH_LOGIN_SUCCEEDED,
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    details: {
      method: "password",
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
