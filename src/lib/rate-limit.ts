type RateLimitEntry = {
  attempts: number[];
  blockedUntil: number;
  windowMs: number;
  maxAttempts: number;
};

type RateLimitOptions = {
  windowMs?: number;
  maxAttempts?: number;
};

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const rateLimitStore = new Map<string, RateLimitEntry>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function getKey(ip: string, endpoint: string) {
  return `${endpoint}:${ip}`;
}

function cleanupExpiredEntries(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (
      now >=
      Math.max(
        entry.blockedUntil,
        (entry.attempts.at(-1) ?? 0) + entry.windowMs,
      )
    ) {
      rateLimitStore.delete(key);
    }
  }
}

function ensureCleanupTimer() {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setInterval(() => {
    cleanupExpiredEntries(Date.now());
  }, CLEANUP_INTERVAL_MS);

  if (
    typeof cleanupTimer === "object" &&
    cleanupTimer &&
    "unref" in cleanupTimer
  ) {
    cleanupTimer.unref();
  }
}

export function getClientIp(request: Request): string {
  const trustProxyHeaders =
    process.env.TRUST_PROXY_HEADERS === "1" &&
    trustedProxySecretMatches(request);

  if (trustProxyHeaders) {
    const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
    if (isValidIp(realIp)) {
      return realIp;
    }
  }

  return "unknown";
}

function trustedProxySecretMatches(request: Request) {
  const configuredSecret = process.env.TRUST_PROXY_HEADER_SECRET?.trim();
  if (!configuredSecret) {
    return false;
  }

  return request.headers.get("x-trusted-proxy-secret") === configuredSecret;
}

function isValidIp(value: string) {
  if (!value) {
    return false;
  }

  const ipv4 =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;

  return ipv4.test(value) || ipv6.test(value);
}

export function checkRateLimit(
  key: string,
  endpoint: string,
  options?: RateLimitOptions,
): { allowed: boolean; retryAfterMs: number } {
  const allowE2eBypass =
    process.env.E2E_DISABLE_RATE_LIMIT === "1" &&
    process.env.NODE_ENV !== "production";

  if (allowE2eBypass) {
    return { allowed: true, retryAfterMs: 0 };
  }

  ensureCleanupTimer();

  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const now = Date.now();
  const compositeKey = getKey(key, endpoint);
  const entry = rateLimitStore.get(compositeKey) ?? {
    attempts: [],
    blockedUntil: 0,
    windowMs,
    maxAttempts,
  };

  if (now < entry.blockedUntil) {
    return {
      allowed: false,
      retryAfterMs: entry.blockedUntil - now,
    };
  }

  // ponytail: bounded per-process buckets; use shared storage before horizontal scaling.
  entry.attempts = entry.attempts.filter(
    (attempt) => now - attempt < entry.windowMs,
  );
  entry.attempts.push(now);
  if (entry.attempts.length >= entry.maxAttempts) {
    entry.blockedUntil = now + entry.windowMs;
  }
  rateLimitStore.set(compositeKey, entry);
  return { allowed: true, retryAfterMs: 0 };
}

export function __resetRateLimitStore() {
  rateLimitStore.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
