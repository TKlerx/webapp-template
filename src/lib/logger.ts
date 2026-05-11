export type LogLevel = "debug" | "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;
type LoggerConfig = {
  level?: LogLevel;
  baseMeta?: LogMeta;
};

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED_KEYS = new Set([
  "authorization",
  "cookie",
  "cookies",
  "password",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "clientSecret",
  "set-cookie",
]);

function getConfiguredLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (
    configured === "debug" ||
    configured === "info" ||
    configured === "warn" ||
    configured === "error"
  ) {
    return configured;
  }

  return "info";
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (depth >= 5) {
    return "[Truncated]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, entryValue]) => {
        if (REDACTED_KEYS.has(key)) {
          return [key, "[REDACTED]"];
        }

        return [key, sanitizeValue(entryValue, depth + 1)];
      },
    );

    return Object.fromEntries(entries);
  }

  return value;
}

function sanitizeMeta(meta: LogMeta) {
  return sanitizeValue(meta) as LogMeta;
}

function shouldLog(configuredLevel: LogLevel, level: LogLevel) {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel];
}

function getConsoleMethod(level: LogLevel) {
  switch (level) {
    case "debug":
      return console.debug;
    case "info":
      return console.info;
    case "warn":
      return console.warn;
    case "error":
      return console.error;
  }
}

export function createRequestId() {
  const webCrypto = globalThis.crypto;

  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  if (webCrypto && typeof webCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    return `req_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  throw new Error("Secure crypto support is required to create request IDs");
}

export function createLogger(config: LoggerConfig = {}) {
  const configuredLevel = config.level ?? getConfiguredLevel();
  const baseMeta = config.baseMeta ?? {};

  function log(level: LogLevel, message: string, meta: LogMeta = {}) {
    if (!shouldLog(configuredLevel, level)) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...sanitizeMeta(baseMeta),
      ...sanitizeMeta(meta),
    };

    getConsoleMethod(level)(JSON.stringify(entry));
  }

  return {
    debug(message: string, meta?: LogMeta) {
      log("debug", message, meta);
    },
    info(message: string, meta?: LogMeta) {
      log("info", message, meta);
    },
    warn(message: string, meta?: LogMeta) {
      log("warn", message, meta);
    },
    error(message: string, meta?: LogMeta) {
      log("error", message, meta);
    },
    child(meta: LogMeta) {
      return createLogger({
        level: configuredLevel,
        baseMeta: {
          ...baseMeta,
          ...meta,
        },
      });
    },
  };
}

export const logger = createLogger({
  baseMeta: {
    app: "business-app-starter",
    environment: process.env.NODE_ENV ?? "development",
  },
});
