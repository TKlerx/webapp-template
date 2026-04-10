import crypto from "node:crypto";
import { safeLogAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { createToken, getDefaultTokenExpiryDays } from "@/services/api/tokens";
import { AuditAction, TokenType } from "../../../generated/prisma/enums";

const AUTH_CODE_TTL_SECONDS = 60;

function getAuthCodeExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + AUTH_CODE_TTL_SECONDS);
  return expiresAt;
}

export function isValidCliCallbackUrl(callbackUrl: string) {
  try {
    const parsed = new URL(callbackUrl);
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export async function createAuthCode(callbackUrl: string, state: string) {
  const record = await prisma.cliAuthCode.create({
    data: {
      code: crypto.randomBytes(24).toString("base64url"),
      callbackUrl,
      state,
      expiresAt: getAuthCodeExpiryDate(),
    },
  });

  return record;
}

export async function bindAuthCodeToUser(codeId: string, userId: string) {
  const record = await prisma.cliAuthCode.findUnique({
    where: { id: codeId },
  });

  if (!record || record.expiresAt < new Date()) {
    return { error: jsonError("CLI login request has expired", 400) };
  }

  const updated = await prisma.cliAuthCode.update({
    where: { id: codeId },
    data: {
      userId,
    },
  });

  return { authCode: updated };
}

export async function exchangeAuthCode(code: string, state: string) {
  const record = await prisma.cliAuthCode.findUnique({
    where: { code },
    include: {
      user: true,
    },
  });

  if (
    !record ||
    record.expiresAt < new Date() ||
    record.exchanged ||
    !record.userId ||
    !record.user ||
    record.state !== state
  ) {
    return { error: jsonError("Invalid or expired authorization code", 400) };
  }

  const tokenResult = await createToken(
    record.userId,
    `CLI Login ${new Date().toISOString()}`,
    getDefaultTokenExpiryDays(TokenType.CLI_LOGIN),
    TokenType.CLI_LOGIN,
  );

  if ("error" in tokenResult) {
    return tokenResult;
  }

  await prisma.cliAuthCode.update({
    where: { id: record.id },
    data: {
      exchanged: true,
    },
  });

  await safeLogAudit({
    action: AuditAction.CLI_LOGIN_COMPLETED,
    entityType: "CliAuthCode",
    entityId: record.id,
    actorId: record.userId,
    details: {
      callbackUrl: record.callbackUrl,
    },
  });

  return {
    token: tokenResult.token.tokenValue,
    expiresAt: tokenResult.token.expiresAt,
    user: {
      name: record.user.name,
      email: record.user.email,
      role: record.user.role,
    },
  };
}

export async function cleanupExpiredCodes() {
  await prisma.cliAuthCode.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}
