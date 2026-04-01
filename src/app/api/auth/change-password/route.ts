import { NextResponse } from "next/server";
import { hashPassword, validatePasswordComplexity, verifyPassword } from "@/lib/auth";
import { safeLogAudit } from "@/lib/audit";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireApiUser } from "@/lib/route-auth";
import { AuditAction } from "../../../../../generated/prisma/enums";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(getClientIp(request), "change-password");
  if (!rateLimit.allowed) {
    const response = jsonError("Too many attempts. Please try again later.", 429);
    response.headers.set("Retry-After", Math.ceil(rateLimit.retryAfterMs / 1000).toString());
    return response;
  }

  const authResult = await requireApiUser();
  if ("error" in authResult) return authResult.error;
  const user = authResult.user;

  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!body.currentPassword || !body.newPassword) {
    return jsonError("Current and new password are required", 400);
  }

  if (!validatePasswordComplexity(body.newPassword)) {
    return jsonError("Password does not meet complexity requirements", 400);
  }

  const credentialAccount = await prisma.account.findUnique({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: user.email.toLowerCase(),
      },
    },
    select: {
      password: true,
    },
  });

  if (!credentialAccount?.password) {
    return jsonError("Password change is only available for local accounts", 400);
  }

  const valid = await verifyPassword(body.currentPassword, credentialAccount.password);

  if (!valid) {
    return jsonError("Current password is incorrect", 401);
  }

  const nextPasswordHash = await hashPassword(body.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        mustChangePassword: false,
      },
    }),
    prisma.account.update({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: user.email.toLowerCase(),
        },
      },
      data: {
        password: nextPasswordHash,
      },
    }),
  ]);

  await auth.api.revokeOtherSessions({
    headers: new Headers(request.headers),
  });

  await safeLogAudit({
    action: AuditAction.AUTH_PASSWORD_CHANGED,
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
  });

  return NextResponse.json({ message: "Password changed successfully" });
}
