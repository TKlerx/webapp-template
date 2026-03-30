import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client";
import { AuthMethod, Role, ThemePreference, UserStatus } from "../generated/prisma/enums";

const connectionString = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = connectionString.startsWith("file:")
  ? new PrismaBetterSqlite3({ url: connectionString })
  : new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be set");
  }

  const existingCount = await prisma.user.count();

  if (existingCount > 0) {
    const admin = await prisma.user.findFirst({
      where: { role: Role.PLATFORM_ADMIN },
    });

    if (!admin) {
      throw new Error("Expected at least one admin user in the starter database.");
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
      role: Role.PLATFORM_ADMIN,
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
