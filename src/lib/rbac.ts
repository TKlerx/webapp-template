import type { User } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";
import { prisma } from "@/lib/db";

export const SCOPED_ROLES = [Role.SCOPE_ADMIN, Role.SCOPE_USER] as const;

export function requireRole(user: Pick<User, "role"> | null, allowedRoles: Role[]) {
  if (!user || !allowedRoles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
}

export function requireAuth<T extends Pick<User, "id">>(user: T | null): T {
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

export function isAdmin(role: Role) {
  return role === Role.PLATFORM_ADMIN;
}

export async function getUserScopeIds(userId: string) {
  const assignments = await prisma.userScopeAssignment.findMany({
    where: { userId },
    select: { scopeId: true },
  });

  return assignments.map((assignment) => assignment.scopeId);
}

export async function requireScopeAccess(
  user: Pick<User, "id" | "role"> | null,
  scopeId: string,
) {
  const authUser = requireAuth(user);

  if (isAdmin(authUser.role)) {
    return true;
  }

  const scopeIds = await getUserScopeIds(authUser.id);

  if (!scopeIds.includes(scopeId)) {
    throw new Error("FORBIDDEN");
  }

  return true;
}
