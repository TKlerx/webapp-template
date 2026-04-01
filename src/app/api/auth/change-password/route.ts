import { NextResponse } from "next/server";
import { getSessionUser, hashPassword, validatePasswordComplexity, verifyPassword } from "@/lib/auth";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return jsonError("Not authenticated", 401);
  }

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

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });

  if (!current) {
    return jsonError("Not authenticated", 401);
  }

  const credentialAccount = await prisma.account.findUnique({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: current.email.toLowerCase(),
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
          accountId: current.email.toLowerCase(),
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

  return NextResponse.json({ message: "Password changed successfully" });
}

