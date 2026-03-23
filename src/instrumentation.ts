import { logger } from "@/lib/logger";

declare global {
  var __businessAppStarterInstrumentationRegistered: boolean | undefined;
}

export async function register() {
  if (globalThis.__businessAppStarterInstrumentationRegistered) {
    return;
  }

  globalThis.__businessAppStarterInstrumentationRegistered = true;

  process.on("uncaughtException", (error) => {
    logger.error("process.uncaught_exception", { error });
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("process.unhandled_rejection", { reason });
  });

  logger.info("observability.initialized", {
    logLevel: process.env.LOG_LEVEL ?? "info",
  });
}
