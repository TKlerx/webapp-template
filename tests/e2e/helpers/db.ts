import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  AuditAction,
  AuthMethod,
  Role,
  ThemePreference,
  UserStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "@/lib/db";

type LocalUserSeed = {
  email: string;
  name: string;
  role: Role;
  password: string;
  mustChangePassword: boolean;
  status?: UserStatus;
};

function normalizeEmail(email: string) {
  return email.toLowerCase();
}

export async function seedLocalUser(user: LocalUserSeed) {
  const normalizedEmail = normalizeEmail(user.email);
  const passwordHash = await bcrypt.hash(user.password, 12);

  const record = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      name: user.name,
      role: user.role,
      status: user.status ?? UserStatus.ACTIVE,
      authMethod: AuthMethod.LOCAL,
      passwordHash,
      mustChangePassword: user.mustChangePassword,
      themePreference: ThemePreference.LIGHT,
      sessions: {
        deleteMany: {},
      },
    },
    create: {
      email: normalizedEmail,
      name: user.name,
      role: user.role,
      status: user.status ?? UserStatus.ACTIVE,
      authMethod: AuthMethod.LOCAL,
      passwordHash,
      mustChangePassword: user.mustChangePassword,
      themePreference: ThemePreference.LIGHT,
      locale: "en",
    },
    select: {
      id: true,
    },
  });

  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: normalizedEmail,
      },
    },
    update: {
      userId: record.id,
      password: passwordHash,
    },
    create: {
      accountId: normalizedEmail,
      providerId: "credential",
      userId: record.id,
      password: passwordHash,
    },
  });

  return record.id;
}

export async function seedSsoUser(user: {
  email: string;
  name: string;
  role?: Role;
  status: UserStatus;
  authMethod?: AuthMethod;
}) {
  const normalizedEmail = normalizeEmail(user.email);
  const record = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      name: user.name,
      role: user.role ?? Role.SCOPE_USER,
      status: user.status,
      authMethod: user.authMethod ?? AuthMethod.SSO,
      passwordHash: null,
      mustChangePassword: false,
      themePreference: ThemePreference.LIGHT,
      sessions: {
        deleteMany: {},
      },
    },
    create: {
      email: normalizedEmail,
      name: user.name,
      role: user.role ?? Role.SCOPE_USER,
      status: user.status,
      authMethod: user.authMethod ?? AuthMethod.SSO,
      passwordHash: null,
      mustChangePassword: false,
      themePreference: ThemePreference.LIGHT,
      locale: "en",
    },
    select: {
      id: true,
    },
  });

  return record.id;
}

export async function findUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      authMethod: true,
    },
  });

  return user ?? null;
}

export async function updateUserStatus(email: string, status: UserStatus) {
  await prisma.user.update({
    where: { email: normalizeEmail(email) },
    data: { status },
  });
}

export async function assignUserToScope(email: string, scope: { code: string; name: string }) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`User not found for assignment: ${email}`);
  }

  const scopeRecord = await prisma.scope.upsert({
    where: { code: scope.code },
    update: {
      name: scope.name,
    },
    create: {
      code: scope.code,
      name: scope.name,
    },
    select: {
      id: true,
    },
  });

  await prisma.userScopeAssignment.upsert({
    where: {
      userId_scopeId: {
        userId: user.id,
        scopeId: scopeRecord.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      scopeId: scopeRecord.id,
    },
  });

  return scopeRecord.id;
}

export async function addAuditEntryFixture(input: {
  actorEmail: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  scopeId?: string | null;
  details?: unknown;
}) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(input.actorEmail) },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`User not found for audit fixture: ${input.actorEmail}`);
  }

  const entry = await prisma.auditEntry.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: user.id,
      scopeId: input.scopeId ?? null,
      details: JSON.stringify(input.details ?? {}),
    },
    select: {
      id: true,
    },
  });

  return entry.id;
}
