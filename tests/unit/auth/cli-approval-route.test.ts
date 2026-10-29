import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiUser, bindAuthCodeToUser, cookieStore } = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  bindAuthCodeToUser: vi.fn(),
  cookieStore: { get: vi.fn(), delete: vi.fn() },
}));

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/route-auth", () => ({ requireApiUser }));
vi.mock("@/lib/azure-auth", () => ({
  getConfiguredBasePath: () => "",
  getScopedCookiePath: () => "/",
}));
vi.mock("@/lib/better-auth-route", () => ({
  getAbsoluteAppUrl: (path: string) => `https://app.example.com/starter${path}`,
}));
vi.mock("@/services/api/cli-auth", () => ({
  CLI_AUTH_CSRF_COOKIE: "cli-csrf",
  bindAuthCodeToUser,
}));

import { POST } from "@/app/api/cli-auth/approve/route";

function request(body: string) {
  return new Request("http://localhost/api/cli-auth/approve", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

describe("CLI approval boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireApiUser.mockResolvedValue({ user: { id: "user-1" } });
    cookieStore.get.mockReturnValue({ value: "csrf-value" });
    bindAuthCodeToUser.mockResolvedValue({
      authCode: {
        callbackUrl: "http://localhost:4545/callback",
        code: "code-1",
        state: "state-1",
      },
    });
  });

  it("binds a validated form to the authenticated user after CSRF verification", async () => {
    const response = await POST(
      request("request=request-1&csrfToken=csrf-value"),
    );
    expect(response.status).toBe(307);
    expect(bindAuthCodeToUser).toHaveBeenCalledWith("request-1", "user-1");
    expect(response.headers.get("location")).toBe(
      "http://localhost:4545/callback?code=code-1&state=state-1",
    );
    expect(cookieStore.delete).toHaveBeenCalledWith({
      name: "cli-csrf",
      path: "/",
    });
  });

  it.each([
    "csrfToken=csrf-value",
    "request=&csrfToken=csrf-value",
    "request=request-1&csrfToken=csrf-value&admin=true",
    "request=request-1&request=request-2&csrfToken=csrf-value",
  ])(
    "rejects malformed approvals before any side effects: %s",
    async (body) => {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      expect(bindAuthCodeToUser).not.toHaveBeenCalled();
      expect(cookieStore.delete).not.toHaveBeenCalled();
    },
  );

  it("still rejects a valid form with a mismatched CSRF token", async () => {
    const response = await POST(request("request=request-1&csrfToken=wrong"));
    expect(response.status).toBe(403);
    expect(bindAuthCodeToUser).not.toHaveBeenCalled();
  });

  it("keeps failed approvals on the configured app origin", async () => {
    bindAuthCodeToUser.mockResolvedValue({ error: "expired" });
    const response = await POST(
      request("request=request-1&csrfToken=csrf-value"),
    );
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/starter/cli-login?error=1",
    );
  });
});
