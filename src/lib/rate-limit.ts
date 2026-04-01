type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const rateLimitStore = new Map<string, RateLimitEntry>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function getKey(ip: string, endpoint: string) {
  return `${endpoint}:${ip}`;
}

function cleanupExpiredEntries(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart >= WINDOW_MS) {
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

  if (typeof cleanupTimer === "object" && cleanupTimer && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstHop = forwardedFor.split(",")[0]?.trim();
    if (firstHop) {
      return firstHop;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function checkRateLimit(ip: string, endpoint: string): { allowed: boolean; retryAfterMs: number } {
  if (process.env.E2E_DISABLE_RATE_LIMIT === "1") {
    return { allowed: true, retryAfterMs: 0 };
  }

  ensureCleanupTimer();

  const now = Date.now();
  const key = getKey(ip, endpoint);
  const existing = rateLimitStore.get(key);

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    rateLimitStore.set(key, {
      count: 1,
      windowStart: now,
    });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (existing.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterMs: Math.max(0, WINDOW_MS - (now - existing.windowStart)),
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return { allowed: true, retryAfterMs: 0 };
}

export function __resetRateLimitStore() {
  rateLimitStore.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
