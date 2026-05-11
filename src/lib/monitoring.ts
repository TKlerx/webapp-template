import { prisma } from "@/lib/db";

export async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok" as const,
    };
  } catch (error) {
    return {
      status: "error" as const,
      message:
        error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

export function getProcessHealth() {
  return {
    status: "ok" as const,
    uptimeSeconds: Math.round(process.uptime()),
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}
