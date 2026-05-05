import {
  getPasswordComplexityErrorMessage,
  hashPassword,
  validatePasswordComplexity,
} from "@/lib/auth";
import { safeLogAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireRouteUser, requireRouteUserWithRoles } from "@/services/api/route-context";
import {
  safeQueueRoleChangedNotifications,
  safeQueueUserCreatedNotifications,
  safeQueueUserStatusChangedNotifications,
} from "@/services/notifications/service";
import type {
  ManagedUserResult,
  ManagedUserStatusUpdateOptions,
  RouteParamsWithId,
} from "@/services/api/types";
import {
  AuditAction,
  AuthMethod,
  Role,
  ThemePreference,
  UserStatus,
} from "../../../generated/prisma/enums";
import type { User } from "../../../generated/prisma/client";

export function parseUserStatusFilter(value: string | null) {
  if (!value) {
    return { status: null };
  }

  if (!Object.values(UserStatus).includes(value as UserStatus)) {
    return {
      error: jsonError(
        "Invalid status filter. Supported values: PENDING_APPROVAL, ACTIVE, INACTIVE",
        400,
      ),
    };
  }

  return { status: value as UserStatus };
}

export async function listUsers(status: UserStatus | null) {
  const users = await prisma.user.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    authMethod: user.authMethod,
    createdAt: user.createdAt,
  }));
}

export async function createLocalUser(
  actorId: string,
  body: {
    email?: string;
    name?: string;
    role?: Role;
    temporaryPassword?: string;
  },
) {
  if (!body.email || !body.name || !body.role || !body.temporaryPassword) {
    return { error: jsonError("Email, name, role, and temporary password are required", 400) };
  }

  if (!Object.values(Role).includes(body.role)) {
    return { error: jsonError("Invalid role", 400) };
  }

  if (!validatePasswordComplexity(body.temporaryPassword)) {
    return { error: jsonError(getPasswordComplexityErrorMessage(), 400) };
  }

  const email = body.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: jsonError("A user with this email already exists", 409) };
  }

  const passwordHash = await hashPassword(body.temporaryPassword);
  const user = await prisma.user.create({
    data: {
      email,
      name: body.name,
      emailVerified: true,
      role: body.role,
      status: UserStatus.ACTIVE,
      authMethod: AuthMethod.LOCAL,
      mustChangePassword: true,
      themePreference: ThemePreference.LIGHT,
      accounts: {
        create: {
          providerId: "credential",
          accountId: email,
          password: passwordHash,
        },
      },
    },
  });

  await safeLogAudit({
    action: AuditAction.USER_CREATED,
    entityType: "User",
    entityId: user.id,
    actorId,
    details: {
      role: body.role,
      authMethod: "LOCAL",
    },
  });

  await safeQueueUserCreatedNotifications({
    actorId,
    user,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      authMethod: user.authMethod,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export async function updateOwnThemePreference(
  actorId: string,
  body: { themePreference?: ThemePreference },
) {
  if (!body.themePreference) {
    return { error: jsonError("Theme preference is required", 400) };
  }

  if (!Object.values(ThemePreference).includes(body.themePreference)) {
    return { error: jsonError("Invalid theme preference", 400) };
  }

  const updated = await prisma.user.update({
    where: { id: actorId },
    data: { themePreference: body.themePreference },
  });

  return { themePreference: updated.themePreference };
}

export async function requireManagedUserContext(
  params: RouteParamsWithId,
): Promise<ManagedUserResult> {
  const auth = await requireRouteUserWithRoles([Role.PLATFORM_ADMIN]);
  if ("error" in auth) {
    return auth;
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    return { error: jsonError("User not found", 404) };
  }

  return { user, actor: auth.user };
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

  if (effectiveRole === Role.PLATFORM_ADMIN && effectiveStatus !== UserStatus.INACTIVE) {
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
  params: RouteParamsWithId,
  nextStatus: UserStatus,
  options?: ManagedUserStatusUpdateOptions,
) {
  const managed = await requireManagedUserContext(params);
  if ("error" in managed) {
    return managed.error;
  }

  const { user, actor } = managed;

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

  await options?.afterUpdate?.({
    actorId: actor.id,
    userId: user.id,
    previousStatus: user.status,
    nextStatus,
  });

  await safeQueueUserStatusChangedNotifications({
    actorId: actor.id,
    user: {
      ...user,
      status: updated.status,
    },
    previousStatus: user.status,
    nextStatus: updated.status,
  });

  return Response.json({ user: { id: updated.id, status: updated.status } });
}

export async function updateManagedUserRole(
  params: RouteParamsWithId,
  body: { role?: Role },
) {
  if (!body.role) {
    return { error: jsonError("Role is required", 400) };
  }

  if (!Object.values(Role).includes(body.role)) {
    return { error: jsonError("Invalid role", 400) };
  }

  const managed = await requireManagedUserContext(params);
  if ("error" in managed) {
    return managed;
  }

  const denied = await ensureAdminUserCanChange(managed.user, {
    role: body.role,
    message: "Cannot change role of the last Admin user",
  });
  if (denied) {
    return { error: denied };
  }

  const updated = await prisma.user.update({
    where: { id: managed.user.id },
    data: { role: body.role },
  });

  await safeLogAudit({
    action: AuditAction.ROLE_CHANGED,
    entityType: "User",
    entityId: managed.user.id,
    actorId: managed.actor.id,
    details: {
      from: managed.user.role,
      to: updated.role,
    },
  });

  await safeQueueRoleChangedNotifications({
    actorId: managed.actor.id,
    user: {
      ...managed.user,
      role: updated.role,
    },
    previousRole: managed.user.role,
    nextRole: updated.role,
  });

  return { user: { id: updated.id, role: updated.role } };
}
