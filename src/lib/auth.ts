import { cookies } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import type { User } from "../../generated/prisma/client";
import { AuthMethod, Role, ThemePreference, UserStatus } from "../../generated/prisma/enums";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "gvi_finance_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export type SessionUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "status" | "themePreference" | "mustChangePassword" | "authMethod"
>;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function validatePasswordComplexity(password: string) {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

export async function provisionSsoUser(input: { email: string; name: string }) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existing) {
    const authMethod =
      existing.authMethod === AuthMethod.LOCAL ? AuthMethod.BOTH : existing.authMethod;

    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: input.name || existing.name,
        authMethod,
      },
    });
  }

  return prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      role: Role.MARKETER,
      status: UserStatus.PENDING_APPROVAL,
      authMethod: AuthMethod.SSO,
      mustChangePassword: false,
      themePreference: ThemePreference.LIGHT,
    },
  });
}

function sessionCookiePath() {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH ?? "/";
}

function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: sessionCookiePath(),
  };
}

async function createSessionRecord(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function createSession(userId: string) {
  const { token, expiresAt } = await createSessionRecord(userId);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function createSessionRedirect(response: NextResponse, userId: string) {
  const { token, expiresAt } = await createSessionRecord(userId);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return response;
}

export async function destroySession(token?: string) {
  const cookieStore = await cookies();
  const sessionToken = token ?? cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionToken) {
    await prisma.session.deleteMany({
      where: { token: sessionToken },
    });
  }

  cookieStore.delete({ name: SESSION_COOKIE, path: sessionCookiePath() });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const headerStore = await nextHeaders();
  const authSession = await auth.api.getSession({
    headers: new Headers(headerStore),
  });

  if (authSession?.user) {
    const freshUser = await prisma.user.findUnique({
      where: { id: authSession.user.id },
    });

    if (!freshUser || freshUser.status === UserStatus.INACTIVE) {
      return null;
    }

    return freshUser;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  if (session.user.status === UserStatus.INACTIVE) {
    return null;
  }

  return session.user;
}

export async function requireSession() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status === UserStatus.PENDING_APPROVAL) {
    redirect("/pending");
  }

  return user;
}

export async function revokeInvalidSsoSession(user: SessionUser) {
  if (user.authMethod === AuthMethod.SSO || user.authMethod === AuthMethod.BOTH) {
    if (user.status === UserStatus.INACTIVE) {
      await destroySession();
      return false;
    }
  }

  return true;
}
