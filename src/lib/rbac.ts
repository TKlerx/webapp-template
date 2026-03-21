import type { User } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";
import { prisma } from "@/lib/db";

export const COUNTRY_SCOPED_ROLES = [Role.COUNTRY_ADMIN, Role.COUNTRY_FINANCE] as const;

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
  return role === Role.GVI_FINANCE_ADMIN;
}

export async function getUserCountryIds(userId: string) {
  const assignments = await prisma.userCountryAssignment.findMany({
    where: { userId },
    select: { countryId: true },
  });

  return assignments.map((assignment) => assignment.countryId);
}

export async function requireCountryAccess(
  user: Pick<User, "id" | "role"> | null,
  countryId: string,
) {
  const authUser = requireAuth(user);

  if (isAdmin(authUser.role)) {
    return true;
  }

  const countryIds = await getUserCountryIds(authUser.id);

  if (!countryIds.includes(countryId)) {
    throw new Error("FORBIDDEN");
  }

  return true;
}
