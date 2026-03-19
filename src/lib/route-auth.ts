import { getSessionUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { Role } from "../../generated/prisma/enums";

export async function requireApiUser() {
  const user = await getSessionUser();

  if (!user) {
    return { error: jsonError("Not authenticated", 401) };
  }

  if (user.status === "PENDING_APPROVAL") {
    return { error: jsonError("Your account is pending approval", 403) };
  }

  return { user };
}

export function ensureRoles(user: { role: Role }, roles: Role[]) {
  try {
    requireRole(user, roles);
    return null;
  } catch {
    return jsonError("Not authorized", 403);
  }
}

export async function requireApiUserWithRoles(roles: Role[]) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth;
  }

  const denied = ensureRoles(auth.user, roles);
  if (denied) {
    return { error: denied };
  }

  return { user: auth.user };
}

