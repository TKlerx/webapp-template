import type { User } from "../../generated/prisma/client";
import { Role, UserStatus } from "../../generated/prisma/enums";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireApiUserWithRoles } from "@/lib/route-auth";

type RouteParams = Promise<{ id: string }>;

export async function requireManagedUser(params: RouteParams) {
  const auth = await requireApiUserWithRoles([Role.GVI_FINANCE_ADMIN]);
  if ("error" in auth) {
    return auth;
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    return { error: jsonError("User not found", 404) };
  }

  return { user };
}

export async function ensureAdminUserCanChange(
  user: Pick<User, "role" | "status">,
  nextState: {
    role?: Role;
    status?: UserStatus;
    message: string;
  },
) {
  if (user.role !== Role.GVI_FINANCE_ADMIN) {
    return null;
  }

  const effectiveRole = nextState.role ?? user.role;
  const effectiveStatus = nextState.status ?? user.status;

  if (
    effectiveRole === Role.GVI_FINANCE_ADMIN &&
    effectiveStatus !== UserStatus.INACTIVE
  ) {
    return null;
  }

  const adminCount = await prisma.user.count({
    where: {
      role: Role.GVI_FINANCE_ADMIN,
      status: { not: UserStatus.INACTIVE },
    },
  });

  if (adminCount <= 1) {
    return jsonError(nextState.message, 400);
  }

  return null;
}
