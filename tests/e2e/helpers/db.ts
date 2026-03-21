import "dotenv/config";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import {
  AuditAction,
  AuthMethod,
  ReviewStatus,
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

async function ensureStoredTestFile(fileName: string, content: string | Buffer) {
  const relativePath = path.posix.join("uploads", "e2e", fileName);
  const absolutePath = path.resolve(process.cwd(), relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
  return relativePath;
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
      user.role ?? Role.COUNTRY_FINANCE,
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
    user.role ?? Role.COUNTRY_FINANCE,
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

export async function assignUserToCountry(email: string, country: { code: string; name: string }) {
  const db = new Database(getDatabasePath());
  const user = db
    .prepare("SELECT id FROM User WHERE email = ?")
    .get(email.toLowerCase()) as { id: string } | undefined;

  if (!user) {
    db.close();
    throw new Error(`User not found for assignment: ${email}`);
  }

  const existingCountry = db
    .prepare("SELECT id FROM ProgramCountry WHERE code = ?")
    .get(country.code) as { id: string } | undefined;

  const countryId = existingCountry?.id ?? createId("country");
  if (!existingCountry) {
    db.prepare(
      `INSERT INTO ProgramCountry (id, name, code, createdAt, updatedAt)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ).run(countryId, country.name, country.code);
  }

  const existingAssignment = db
    .prepare("SELECT id FROM UserCountryAssignment WHERE userId = ? AND countryId = ?")
    .get(user.id, countryId) as { id: string } | undefined;

  if (!existingAssignment) {
    db.prepare(
      `INSERT INTO UserCountryAssignment (id, userId, countryId, createdAt)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    ).run(createId("assignment"), user.id, countryId);
  }

  db.close();
  return countryId;
}

type ReceiptFixtureInput = {
  uploadedByEmail: string;
  countryCode: string;
  countryName: string;
  budgetYearLabel: string;
  budgetYearStart?: string;
  budgetYearEnd?: string;
  countryBudgetTotal?: number;
  currency?: string;
  budgetItemName: string;
  amount: number;
  description: string;
  fileName?: string;
  mimeType?: string;
  fileContent?: string | Buffer;
  reviewStatus?: ReviewStatus;
  receiptDate?: string;
};

export async function seedReceiptFixture(input: ReceiptFixtureInput) {
  const db = new Database(getDatabasePath());
  const user = db
    .prepare("SELECT id FROM User WHERE email = ?")
    .get(input.uploadedByEmail.toLowerCase()) as { id: string } | undefined;

  if (!user) {
    db.close();
    throw new Error(`User not found for receipt fixture: ${input.uploadedByEmail}`);
  }

  const existingCountry = db
    .prepare("SELECT id FROM ProgramCountry WHERE code = ?")
    .get(input.countryCode) as { id: string } | undefined;
  const countryId = existingCountry?.id ?? createId("country");
  if (!existingCountry) {
    db.prepare(
      `INSERT INTO ProgramCountry (id, name, code, createdAt, updatedAt)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ).run(countryId, input.countryName, input.countryCode);
  }

  const existingAssignment = db
    .prepare("SELECT id FROM UserCountryAssignment WHERE userId = ? AND countryId = ?")
    .get(user.id, countryId) as { id: string } | undefined;
  if (!existingAssignment) {
    db.prepare(
      `INSERT INTO UserCountryAssignment (id, userId, countryId, createdAt)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    ).run(createId("assignment"), user.id, countryId);
  }

  const existingBudgetYear = db
    .prepare("SELECT id FROM BudgetYear WHERE label = ?")
    .get(input.budgetYearLabel) as { id: string } | undefined;
  const budgetYearId = existingBudgetYear?.id ?? createId("year");
  if (!existingBudgetYear) {
    db.prepare(
      `INSERT INTO BudgetYear (id, label, startDate, endDate, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ).run(
      budgetYearId,
      input.budgetYearLabel,
      input.budgetYearStart ?? `${new Date().getUTCFullYear()}-01-01T00:00:00.000Z`,
      input.budgetYearEnd ?? `${new Date().getUTCFullYear()}-12-31T23:59:59.999Z`,
    );
  }

  const existingCountryBudget = db
    .prepare("SELECT id FROM CountryBudget WHERE budgetYearId = ? AND countryId = ?")
    .get(budgetYearId, countryId) as { id: string } | undefined;
  const countryBudgetId = existingCountryBudget?.id ?? createId("countrybudget");
  if (!existingCountryBudget) {
    db.prepare(
      `INSERT INTO CountryBudget (id, budgetYearId, countryId, totalAmount, currency, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ).run(
      countryBudgetId,
      budgetYearId,
      countryId,
      input.countryBudgetTotal ?? 1000,
      input.currency ?? "EUR",
    );
  }

  const budgetItemId = createId("budgetitem");
  db.prepare(
    `INSERT INTO BudgetItem (id, countryBudgetId, parentId, name, plannedAmount, description, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, NULL, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  ).run(
    budgetItemId,
    countryBudgetId,
    input.budgetItemName,
    input.countryBudgetTotal ?? 1000,
    input.description,
  );

  const fileName = input.fileName ?? `${createId("receipt")}.pdf`;
  const mimeType = input.mimeType ?? "application/pdf";
  const filePath = await ensureStoredTestFile(
    fileName,
    input.fileContent ?? "%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF",
  );

  const receiptId = createId("receipt");
  db.prepare(
    `INSERT INTO Receipt (
      id, budgetItemId, uploadedById, reviewStatus, amount, currency, date, description,
      fileName, filePath, fileSize, mimeType, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  ).run(
    receiptId,
    budgetItemId,
    user.id,
    input.reviewStatus ?? ReviewStatus.PENDING_REVIEW,
    input.amount,
    input.currency ?? "EUR",
    input.receiptDate ?? new Date().toISOString(),
    input.description,
    fileName,
    filePath,
    Buffer.byteLength(String(input.fileContent ?? "pdf")),
    mimeType,
  );

  db.close();
  return { receiptId, budgetItemId, countryId, countryBudgetId, budgetYearId, filePath };
}

export async function addReviewCommentFixture(input: {
  receiptId: string;
  authorEmail: string;
  text: string;
}) {
  const db = new Database(getDatabasePath());
  const user = db
    .prepare("SELECT id FROM User WHERE email = ?")
    .get(input.authorEmail.toLowerCase()) as { id: string } | undefined;
  if (!user) {
    db.close();
    throw new Error(`User not found for comment fixture: ${input.authorEmail}`);
  }

  const id = createId("comment");
  db.prepare(
    `INSERT INTO ReviewComment (id, receiptId, authorId, text, createdAt)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
  ).run(id, input.receiptId, user.id, input.text);
  db.close();
  return id;
}

export async function addAuditEntryFixture(input: {
  actorEmail: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  countryId?: string | null;
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
    `INSERT INTO AuditEntry (id, action, entityType, entityId, actorId, countryId, details, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
  ).run(
    id,
    input.action,
    input.entityType,
    input.entityId,
    user.id,
    input.countryId ?? null,
    JSON.stringify(input.details ?? {}),
  );

  db.close();
  return id;
}
