import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetRateLimitStore,
  checkRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

describe("rate limit utility", () => {
  const originalTrustProxyHeaders = process.env.TRUST_PROXY_HEADERS;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T10:00:00Z"));
    __resetRateLimitStore();
    delete process.env.TRUST_PROXY_HEADERS;
  });

  afterEach(() => {
    __resetRateLimitStore();
    vi.useRealTimers();
    if (originalTrustProxyHeaders === undefined) {
      delete process.env.TRUST_PROXY_HEADERS;
    } else {
      process.env.TRUST_PROXY_HEADERS = originalTrustProxyHeaders;
    }
  });

  it("allows five attempts and blocks the sixth", () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(checkRateLimit("127.0.0.1", "login")).toEqual({
        allowed: true,
        retryAfterMs: 0,
      });
    }

    const blocked = checkRateLimit("127.0.0.1", "login");

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(15 * 60 * 1000);
  });

  it("resets after the window expires", () => {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      checkRateLimit("127.0.0.1", "login");
    }

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    expect(checkRateLimit("127.0.0.1", "login")).toEqual({
      allowed: true,
      retryAfterMs: 0,
    });
  });

  it("tracks endpoints independently", () => {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      checkRateLimit("127.0.0.1", "login");
    }

    expect(checkRateLimit("127.0.0.1", "change-password")).toEqual({
      allowed: true,
      retryAfterMs: 0,
    });
  });

  it("ignores proxy headers by default", () => {
    const forwardedRequest = new Request("http://localhost/test", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.5",
        "x-real-ip": "198.51.100.3",
      },
    });

    expect(getClientIp(forwardedRequest)).toBe("unknown");
  });

  it("extracts the client IP from trusted proxy headers when enabled", () => {
    process.env.TRUST_PROXY_HEADERS = "1";

    const forwardedRequest = new Request("http://localhost/test", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.5",
        "x-real-ip": "198.51.100.3",
      },
    });
    const realIpRequest = new Request("http://localhost/test", {
      headers: {
        "x-real-ip": "198.51.100.3",
      },
    });
    const unknownRequest = new Request("http://localhost/test");

    expect(getClientIp(forwardedRequest)).toBe("203.0.113.10");
    expect(getClientIp(realIpRequest)).toBe("198.51.100.3");
    expect(getClientIp(unknownRequest)).toBe("unknown");
  });
});
