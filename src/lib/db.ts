import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { resolveAppDatabaseUrl } from "@/lib/database-url";

function createAdapter(connectionString: string) {
  return new PrismaPg(
    { connectionString },
    { schema: getPostgresSchema(connectionString) },
  );
}

function getPostgresSchema(connectionString: string) {
  return new URL(connectionString).searchParams.get("schema") ?? undefined;
}

function createPrismaClient() {
  return new PrismaClient({ adapter });
}

type AppPrismaClient = ReturnType<typeof createPrismaClient>;

declare global {
  var prisma: AppPrismaClient | undefined;
}

const connectionString = resolveAppDatabaseUrl();
const adapter = createAdapter(connectionString);

export const prisma: AppPrismaClient =
  globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
