import "dotenv/config";
import path from "node:path";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import {
  AuditAction,
  AuthMethod,
  Role,
  ThemePreference,
  UserStatus,
} from "../../../generated/prisma/enums";

type LocalUserSeed = {
  email: string;
  name: string;
  role: Role;
  password: string;
  mustChangePassword: boolean;
  status?: UserStatus;
};

function getDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`Unsupported DATABASE_URL for E2E tests: ${databaseUrl}`);
  }

  return path.resolve(process.cwd(), databaseUrl.slice("file:".length));
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 14)}`;
}

function upsertCredentialAccount(
  db: InstanceType<typeof Database>,
  userId: string,
  email: string,
  passwordHash: string,
) {
  const existingAccount = db
    .prepare("SELECT id FROM Account WHERE providerId = ? AND accountId = ?")
    .get("credential", email.toLowerCase()) as { id: string } | undefined;

  if (existingAccount) {
    db.prepare(
      `UPDATE Account
       SET userId = ?, password = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(userId, passwordHash, existingAccount.id);
    return;
  }

  db.prepare(
    `INSERT INTO Account (
      id, accountId, providerId, userId, password, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  ).run(createId("account"), email.toLowerCase(), "credential", userId, passwordHash);
}

export async function seedLocalUser(user: LocalUserSeed) {
  const db = new Database(getDatabasePath());
  const passwordHash = await bcrypt.hash(user.password, 12);
  const existing = db
    .prepare("SELECT id FROM User WHERE email = ?")
    .get(user.email.toLowerCase()) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE User
       SET name = ?, role = ?, status = ?, authMethod = ?, passwordHash = ?, mustChangePassword = ?, themePreference = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(
      user.name,
      user.role,
      user.status ?? UserStatus.ACTIVE,
      AuthMethod.LOCAL,
      passwordHash,
      user.mustChangePassword ? 1 : 0,
      ThemePreference.LIGHT,
      existing.id,
    );

    upsertCredentialAccount(db, existing.id, user.email, passwordHash);
    db.prepare("DELETE FROM Session WHERE userId = ?").run(existing.id);
    db.close();
    return existing.id;
  }

  const id = createId("e2e");
  db.prepare(
    `INSERT INTO User (
      id, email, name, role, status, authMethod, passwordHash, mustChangePassword, themePreference, locale, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  ).run(
    id,
    user.email.toLowerCase(),
    user.name,
    user.role,
    user.status ?? UserStatus.ACTIVE,
    AuthMethod.LOCAL,
    passwordHash,
    user.mustChangePassword ? 1 : 0,
    ThemePreference.LIGHT,
    "en",
  );

  upsertCredentialAccount(db, id, user.email, passwordHash);
  db.close();
  return id;
}

export async function seedSsoUser(user: {
  email: string;
  name: string;
  role?: Role;
  status: UserStatus;
  authMethod?: AuthMethod;
}) {
  const db = new Database(getDatabasePath());
  const normalizedEmail = user.email.toLowerCase();
  const existing = db
    .prepare("SELECT id FROM User WHERE email = ?")
    .get(normalizedEmail) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE User
       SET name = ?, role = ?, status = ?, authMethod = ?, passwordHash = NULL, mustChangePassword = 0, themePreference = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(
      user.name,
      user.role ?? Role.SCOPE_USER,
      user.status,
      user.authMethod ?? AuthMethod.SSO,
      ThemePreference.LIGHT,
      existing.id,
    );
    db.prepare("DELETE FROM Session WHERE userId = ?").run(existing.id);
    db.close();
    return existing.id;
  }

  const id = createId("sso");
  db.prepare(
    `INSERT INTO User (
      id, email, name, role, status, authMethod, passwordHash, mustChangePassword, themePreference, locale, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  ).run(
    id,
    normalizedEmail,
    user.name,
    user.role ?? Role.SCOPE_USER,
    user.status,
    user.authMethod ?? AuthMethod.SSO,
    ThemePreference.LIGHT,
    "en",
  );

  db.close();
  return id;
}

export async function findUserByEmail(email: string) {
  const db = new Database(getDatabasePath(), { readonly: true });
  const user = db
    .prepare("SELECT id, email, name, role, status, authMethod FROM User WHERE email = ?")
    .get(email.toLowerCase()) as
      | {
          id: string;
          email: string;
          name: string;
          role: Role;
          status: UserStatus;
          authMethod: AuthMethod;
        }
      | undefined;
  db.close();
  return user ?? null;
}

export async function updateUserStatus(email: string, status: UserStatus) {
  const db = new Database(getDatabasePath());
  db.prepare("UPDATE User SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE email = ?").run(
    status,
    email.toLowerCase(),
  );
  db.close();
}

export async function assignUserToScope(email: string, scope: { code: string; name: string }) {
  const db = new Database(getDatabasePath());
  const user = db
    .prepare("SELECT id FROM User WHERE email = ?")
    .get(email.toLowerCase()) as { id: string } | undefined;

  if (!user) {
    db.close();
    throw new Error(`User not found for assignment: ${email}`);
  }

  const existingScope = db
    .prepare("SELECT id FROM Scope WHERE code = ?")
    .get(scope.code) as { id: string } | undefined;

  const scopeId = existingScope?.id ?? createId("scope");
  if (!existingScope) {
    db.prepare(
      `INSERT INTO Scope (id, name, code, createdAt, updatedAt)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ).run(scopeId, scope.name, scope.code);
  }

  const existingAssignment = db
    .prepare("SELECT id FROM UserScopeAssignment WHERE userId = ? AND scopeId = ?")
    .get(user.id, scopeId) as { id: string } | undefined;

  if (!existingAssignment) {
    db.prepare(
      `INSERT INTO UserScopeAssignment (id, userId, scopeId, createdAt)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    ).run(createId("assignment"), user.id, scopeId);
  }

  db.close();
  return scopeId;
}

export async function addAuditEntryFixture(input: {
  actorEmail: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  scopeId?: string | null;
  details?: unknown;
}) {
  const db = new Database(getDatabasePath());
  const user = db
    .prepare("SELECT id FROM User WHERE email = ?")
    .get(input.actorEmail.toLowerCase()) as { id: string } | undefined;
  if (!user) {
    db.close();
    throw new Error(`User not found for audit fixture: ${input.actorEmail}`);
  }

  const id = createId("audit");
  db.prepare(
    `INSERT INTO AuditEntry (id, action, entityType, entityId, actorId, scopeId, details, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
  ).run(
    id,
    input.action,
    input.entityType,
    input.entityId,
    user.id,
    input.scopeId ?? null,
    JSON.stringify(input.details ?? {}),
  );

  db.close();
  return id;
}
