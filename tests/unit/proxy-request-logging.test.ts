import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/azure-auth", () => ({
  getScopedCookiePath: () => "/starter",
}));

vi.mock("@/lib/better-auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
  getBetterAuthCookieNames: () => ["better-auth.session_token"],
}));

function createRequest(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

describe("proxy request logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("does not emit request logs when explicitly disabled", async () => {
    vi.stubEnv("ENABLE_REQUEST_LOGGING", "false");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      createRequest("https://example.test/login?token=secret", {
        "x-request-id": "req-123",
      }),
    );

    expect(response.headers.get("x-request-id")).toBe("req-123");
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("logs forwarding without claiming a downstream status", async () => {
    vi.stubEnv("ENABLE_REQUEST_LOGGING", undefined);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      createRequest("https://example.test/login?page=1&token=secret", {
        "x-request-id": "req-456",
      }),
    );

    expect(response.headers.get("x-request-id")).toBe("req-456");
    expect(infoSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(String(infoSpy.mock.calls[0][0]));
    expect(payload).toMatchObject({
      event: "http.request.forwarded",
      component: "proxy",
      requestId: "req-456",
      method: "GET",
      path: "/login",
    });
    expect(payload).not.toHaveProperty("status");
    expect(payload.proxyDurationMs).toBeGreaterThanOrEqual(0);
    expect(response.headers.get("x-middleware-request-x-request-id")).toBe(
      "req-456",
    );
    expect(String(infoSpy.mock.calls[0][0])).not.toContain("token=secret");
  });

  it("reports the final status when the proxy responds directly", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { proxy } = await import("@/proxy");

    const response = await proxy(
      createRequest("https://example.test/dashboard"),
    );

    expect(response.status).toBe(307);
    expect(JSON.parse(String(infoSpy.mock.calls[0][0]))).toMatchObject({
      event: "http.request.completed",
      requestId: response.headers.get("x-request-id"),
      status: 307,
    });
  });

  it("logs only allowlisted request query fields", async () => {
    vi.stubEnv("ENABLE_REQUEST_LOGGING", "true");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { proxy } = await import("@/proxy");

    await proxy(
      createRequest(
        "https://example.test/login?page=1&sort=createdAt&email=person%40example.com",
        {
          "x-request-id": "req-789",
        },
      ),
    );

    const payload = JSON.parse(String(infoSpy.mock.calls[0][0]));
    expect(payload).toMatchObject({
      path: "/login",
      query: {
        page: "1",
        sort: "createdAt",
      },
    });
    expect(String(infoSpy.mock.calls[0][0])).not.toContain(
      "person@example.com",
    );
    expect(String(infoSpy.mock.calls[0][0])).not.toContain("email");
  });
});
