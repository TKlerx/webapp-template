import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client";
import { AuthMethod, Role, ThemePreference, UserStatus } from "../generated/prisma/enums";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

const legacyRoleMap = {
  ADMIN: Role.GVI_FINANCE_ADMIN,
  MARKETER_LEAD: Role.COUNTRY_ADMIN,
  MARKETER: Role.COUNTRY_FINANCE,
  REVIEWER: Role.COUNTRY_FINANCE,
} as const;

async function migrateLegacyRoles() {
  const roleRows = (await prisma.$queryRaw<Array<{ id: string; role: keyof typeof legacyRoleMap }>>`
    SELECT id, role
    FROM User
    WHERE role IN ('ADMIN', 'MARKETER_LEAD', 'MARKETER', 'REVIEWER')
  `);

  for (const row of roleRows) {
    await prisma.user.update({
      where: { id: row.id },
      data: { role: legacyRoleMap[row.role] },
    });
  }

  return roleRows.length;
}

async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be set");
  }

  const migratedCount = await migrateLegacyRoles();
  if (migratedCount > 0) {
    console.log(`Migrated ${migratedCount} legacy user role assignments.`);
  }

  const existingCount = await prisma.user.count();

  if (existingCount > 0) {
    const admin = await prisma.user.findFirst({
      where: { role: Role.GVI_FINANCE_ADMIN },
    });

    if (!admin) {
      throw new Error("Expected at least one GVI Finance Admin after role migration.");
    }

    console.log("Skipping seed because users already exist.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      emailVerified: true,
      name: "Initial Admin",
      role: Role.GVI_FINANCE_ADMIN,
      status: UserStatus.ACTIVE,
      authMethod: AuthMethod.LOCAL,
      passwordHash,
      mustChangePassword: true,
      themePreference: ThemePreference.LIGHT,
      locale: "en",
      accounts: {
        create: {
          providerId: "credential",
          accountId: email.toLowerCase(),
          password: passwordHash,
        },
      },
    },
  });

  console.log(`Seeded initial admin user ${email}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
