import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";

const { signInSocial, signOut } = vi.hoisted(() => ({
  signInSocial: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/better-auth", () => ({
  auth: { api: { signInSocial, signOut } },
  BETTER_AUTH_API_BASE_PATH: "/starter/api/auth",
  getConfiguredAuthBaseUrl: () =>
    process.env.AUTH_BASE_URL ?? "https://app.example.com",
}));

import { GET as startSso } from "@/app/api/auth/sso/azure/route";
import { getAbsoluteAppUrl } from "@/lib/better-auth-route";
import { signOutUser } from "@/services/api/auth";

beforeEach(() => {
  vi.stubEnv("AUTH_BASE_URL", "https://app.example.com");
  vi.stubEnv("BASE_PATH", "/starter");
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/starter");
  vi.stubEnv("E2E_MOCK_SSO", "0");
  vi.stubEnv("AZURE_AD_CLIENT_ID", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("keeps SSO error redirects on the configured origin despite request host and forwarding headers", async () => {
  const response = await startSso(
    new Request("https://untrusted.invalid/api/auth/sso/azure", {
      headers: {
        "x-forwarded-host": "untrusted.invalid",
        "x-forwarded-proto": "http",
      },
    }),
  );
  expect(response.headers.get("location")).toBe(
    "https://app.example.com/starter/login?error=sso-config",
  );
});

it("builds only local app destinations, preserving query data and an existing base path", () => {
  expect(getAbsoluteAppUrl("/dashboard?next=https%3A%2F%2Fexample.com")).toBe(
    "https://app.example.com/starter/dashboard?next=https%3A%2F%2Fexample.com",
  );
  expect(getAbsoluteAppUrl("/starter/admin?tab=teams")).toBe(
    "https://app.example.com/starter/admin?tab=teams",
  );
  for (const path of [
    "//example.com",
    "/\\example.com",
    "/\t/example.com",
    "https://example.com",
    "relative",
  ]) {
    expect(() => getAbsoluteAppUrl(path)).toThrow(
      "Invalid local redirect path",
    );
  }
  for (const basePath of [
    "//example.com",
    "//",
    "/starter?next=other",
    "/starter#fragment",
  ]) {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", basePath);
    expect(() => getAbsoluteAppUrl("/dashboard")).toThrow(
      "Invalid app base path",
    );
  }
});

it("keeps logout on the configured app origin and forwards expired session cookies", async () => {
  signOut.mockResolvedValue(
    new Response(null, {
      headers: { "set-cookie": "session=; Max-Age=0; Path=/starter" },
    }),
  );
  const response = await signOutUser(
    new Request("https://untrusted.invalid/api/auth/logout"),
    null,
  );
  expect(response.headers.get("location")).toBe(
    "https://app.example.com/starter/login",
  );
  expect(response.headers.get("set-cookie")).toContain("session=; Max-Age=0");
});

it("uses only the origin from a legacy auth URL that already contains the app path", () => {
  vi.stubEnv("AUTH_BASE_URL", "https://app.example.com/starter/");
  expect(getAbsoluteAppUrl("/dashboard")).toBe(
    "https://app.example.com/starter/dashboard",
  );
  expect(getAbsoluteAppUrl("/starter/dashboard")).toBe(
    "https://app.example.com/starter/dashboard",
  );
});

it.each([
  "https://untrusted.invalid/tenant/oauth2/v2.0/authorize",
  "https://login.microsoftonline.com.untrusted.invalid/tenant/oauth2/v2.0/authorize",
  "http://login.microsoftonline.com/tenant/oauth2/v2.0/authorize",
  "https://user@login.microsoftonline.com/tenant/oauth2/v2.0/authorize",
  "https://login.microsoftonline.com/other/oauth2/v2.0/authorize",
  "https://login.microsoftonline.com/tenant/other",
  "/relative",
])(
  "rejects an unexpected provider redirect destination: %s",
  async (location) => {
    vi.stubEnv("AZURE_AD_CLIENT_ID", "client");
    vi.stubEnv("AZURE_AD_CLIENT_SECRET", "test-only-client-secret");
    vi.stubEnv("AZURE_AD_TENANT_ID", "tenant");
    signInSocial.mockResolvedValue(
      new Response(null, { headers: { location } }),
    );
    const response = await startSso(
      new Request("https://app.example.com/api/auth/sso/azure"),
    );
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/starter/login?error=sso-provider",
    );
  },
);

it("preserves the configured Microsoft endpoint, opaque OAuth query and provider state cookie", async () => {
  vi.stubEnv("AZURE_AD_CLIENT_ID", "client");
  vi.stubEnv("AZURE_AD_CLIENT_SECRET", "test-only-client-secret");
  vi.stubEnv("AZURE_AD_TENANT_ID", "tenant");
  const location =
    "https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?state=opaque&redirect_uri=https%3A%2F%2Fapp.example.com%2Fstarter%2Fapi%2Fauth%2Fcallback%2Fmicrosoft";
  signInSocial.mockResolvedValue(
    new Response(null, {
      headers: {
        location,
        "set-cookie": "oauth-state=opaque; HttpOnly; Path=/starter",
      },
    }),
  );
  const response = await startSso(
    new Request(
      "https://untrusted.invalid/api/auth/sso/azure?redirectTo=%2Fstarter%2Fdashboard",
    ),
  );
  expect(response.headers.get("location")).toBe(location);
  expect(response.headers.get("set-cookie")).toContain("oauth-state=opaque");
  expect(signInSocial).toHaveBeenCalledWith(
    expect.objectContaining({
      body: {
        provider: "microsoft",
        callbackURL: "https://app.example.com/starter/dashboard",
      },
    }),
  );
});
