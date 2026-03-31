import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

function createPrismaClient() {
  return new PrismaClient({ adapter });
}

type AppPrismaClient = ReturnType<typeof createPrismaClient>;

declare global {
  var prisma: AppPrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = connectionString.startsWith("file:")
  ? new PrismaBetterSqlite3({ url: connectionString })
  : new PrismaPg({ connectionString });

export const prisma: AppPrismaClient = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
