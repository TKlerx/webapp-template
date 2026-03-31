import type { User } from "../../generated/prisma/client";
import { AuthMethod, Role, ThemePreference, UserStatus } from "../../generated/prisma/enums";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireApiUserWithRoles } from "@/lib/route-auth";

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
      role: Role.SCOPE_USER,
      status: UserStatus.PENDING_APPROVAL,
      authMethod: AuthMethod.SSO,
      mustChangePassword: false,
      themePreference: ThemePreference.LIGHT,
    },
  });
}

type RouteParams = Promise<{ id: string }>;

export async function requireManagedUser(params: RouteParams) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN]);
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
  if (user.role !== Role.PLATFORM_ADMIN) {
    return null;
  }

  const effectiveRole = nextState.role ?? user.role;
  const effectiveStatus = nextState.status ?? user.status;

  if (
    effectiveRole === Role.PLATFORM_ADMIN &&
    effectiveStatus !== UserStatus.INACTIVE
  ) {
    return null;
  }

  const adminCount = await prisma.user.count({
    where: {
      role: Role.PLATFORM_ADMIN,
      status: { not: UserStatus.INACTIVE },
    },
  });

  if (adminCount <= 1) {
    return jsonError(nextState.message, 400);
  }

  return null;
}

export async function updateManagedUserStatus(
  params: RouteParams,
  nextStatus: UserStatus,
  options?: {
    requireCurrentStatus?: UserStatus;
    blockedMessage?: string;
    lastAdminMessage?: string;
  },
) {
  const managed = await requireManagedUser(params);
  if ("error" in managed) {
    return managed.error;
  }

  const { user } = managed;

  if (options?.requireCurrentStatus && user.status !== options.requireCurrentStatus) {
    return jsonError(options.blockedMessage ?? "User is in an invalid status", 400);
  }

  if (options?.lastAdminMessage) {
    const denied = await ensureAdminUserCanChange(user, {
      status: nextStatus,
      message: options.lastAdminMessage,
    });

    if (denied) {
      return denied;
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: nextStatus },
  });

  return Response.json({ user: { id: updated.id, status: updated.status } });
}
