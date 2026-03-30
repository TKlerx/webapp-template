import { logger } from "@/lib/logger";

declare global {
  var __businessAppStarterInstrumentationRegistered: boolean | undefined;
}

export async function register() {
  if (globalThis.__businessAppStarterInstrumentationRegistered) {
    return;
  }

  globalThis.__businessAppStarterInstrumentationRegistered = true;

  const processRef = getNodeProcess();
  if (processRef) {
    processRef.on("uncaughtException", (error) => {
      logger.error("process.uncaught_exception", { error });
    });

    processRef.on("unhandledRejection", (reason) => {
      logger.error("process.unhandled_rejection", { reason });
    });
  }

  logger.info("observability.initialized", {
    logLevel: process.env.LOG_LEVEL ?? "info",
  });
}

function getNodeProcess() {
  const candidate = (globalThis as typeof globalThis & {
    process?: NodeJS.Process;
    EdgeRuntime?: unknown;
  }).process;
  const isEdgeRuntime =
    typeof (globalThis as typeof globalThis & { EdgeRuntime?: unknown }).EdgeRuntime !== "undefined";

  if (isEdgeRuntime || !candidate || typeof candidate.on !== "function") {
    return null;
  }

  return candidate;
}
