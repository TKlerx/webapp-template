import { hashPassword, validatePasswordComplexity } from "@/lib/auth";
import { safeLogAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireApiUserWithRoles } from "@/lib/route-auth";
import {
  AuditAction,
  AuthMethod,
  Role,
  ThemePreference,
  UserStatus,
} from "../../../../generated/prisma/enums";

export async function GET(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN]);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as UserStatus | null;

  if (status && !Object.values(UserStatus).includes(status)) {
    return jsonError("Invalid status filter. Supported values: PENDING_APPROVAL, ACTIVE, INACTIVE", 400);
  }

  const users = await prisma.user.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      authMethod: user.authMethod,
      createdAt: user.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN]);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    email?: string;
    name?: string;
    role?: Role;
    temporaryPassword?: string;
  };

  if (!body.email || !body.name || !body.role || !body.temporaryPassword) {
    return jsonError("Email, name, role, and temporary password are required", 400);
  }

  if (!Object.values(Role).includes(body.role)) {
    return jsonError("Invalid role", 400);
  }

  if (!validatePasswordComplexity(body.temporaryPassword)) {
    return jsonError("Password does not meet complexity requirements", 400);
  }

  const email = body.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError("A user with this email already exists", 409);

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
    actorId: auth.user.id,
    details: {
      role: body.role,
      authMethod: "LOCAL",
    },
  });

  return Response.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        authMethod: user.authMethod,
        mustChangePassword: user.mustChangePassword,
      },
    },
    { status: 201 },
  );
}

