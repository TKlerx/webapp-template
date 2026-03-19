import { NextResponse } from "next/server";
import { getSessionUser, hashPassword, validatePasswordComplexity, verifyPassword } from "@/lib/auth";
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

  const current = await prisma.user.findUnique({ where: { id: user.id } });

  if (!current?.passwordHash) {
    return jsonError("Password change is only available for local accounts", 400);
  }

  const valid = await verifyPassword(body.currentPassword, current.passwordHash);

  if (!valid) {
    return jsonError("Current password is incorrect", 401);
  }

  const nextPasswordHash = await hashPassword(body.newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: nextPasswordHash,
      mustChangePassword: false,
    },
  });

  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: current.email.toLowerCase(),
      },
    },
    update: {
      password: nextPasswordHash,
    },
    create: {
      userId: user.id,
      providerId: "credential",
      accountId: current.email.toLowerCase(),
      password: nextPasswordHash,
    },
  });

  return NextResponse.json({ message: "Password changed successfully" });
}

