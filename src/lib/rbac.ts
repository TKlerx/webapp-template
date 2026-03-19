import type { User } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";

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
  return role === Role.ADMIN;
}
