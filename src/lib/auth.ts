import { cache } from "react";
import { redirect } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import type { User } from "../../generated/prisma/client";
import { UserStatus } from "../../generated/prisma/enums";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/db";

export type SessionUser = Pick<
  User,
  | "id"
  | "email"
  | "name"
  | "role"
  | "status"
  | "themePreference"
  | "locale"
  | "mustChangePassword"
  | "authMethod"
>;

export { hashPassword, verifyPassword } from "@/lib/password";

export const PASSWORD_COMPLEXITY_REQUIREMENTS =
  "at least 8 characters, including at least 1 uppercase letter, 1 lowercase letter, and 1 number, and fit within 72 UTF-8 bytes";

export function validatePasswordComplexity(password: string) {
  return (
    password.length >= 8 &&
    Buffer.byteLength(password, "utf8") <= 72 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

export function getPasswordComplexityErrorMessage() {
  return `Password must contain ${PASSWORD_COMPLEXITY_REQUIREMENTS}.`;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
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

  return null;
});

export async function requireSession({
  allowRequiredPasswordChange = false,
} = {}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status === UserStatus.PENDING_APPROVAL) {
    redirect("/pending");
  }

  if (user.mustChangePassword && !allowRequiredPasswordChange) {
    redirect("/change-password");
  }

  return user;
}
