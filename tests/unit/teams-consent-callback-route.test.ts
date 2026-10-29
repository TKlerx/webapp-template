import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";

const { exchange, save, cookieStore } = vi.hoisted(() => ({
  exchange: vi.fn(),
  save: vi.fn(),
  cookieStore: { get: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/route-auth", () => ({
  requireApiUserWithRoles: async () => ({ user: { id: "admin-1" } }),
}));
vi.mock("@/lib/better-auth", () => ({
  auth: {},
  BETTER_AUTH_API_BASE_PATH: "/starter/api/auth",
  getConfiguredAuthBaseUrl: () => "https://app.example.com",
}));
vi.mock("@/services/teams/consent", async () => ({
  ...(await vi.importActual<typeof import("@/services/teams/consent")>(
    "@/services/teams/consent",
  )),
  exchangeTeamsConsentCode: exchange,
  saveTeamsDelegatedGrant: save,
}));

import { GET } from "@/app/api/integrations/teams/consent/callback/route";

beforeEach(() => {
  vi.stubEnv("BASE_PATH", "/starter");
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/starter");
  cookieStore.get.mockReturnValue({
    value: "state-123:/starter/admin/integrations/teams?tab=consent",
  });
  exchange.mockResolvedValue({ access_token: "test-only-token" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

it.each(["state-error", "connected", "failed"])(
  "keeps the %s outcome on the configured origin and preserves local query parameters",
  async (outcome) => {
    if (outcome === "failed")
      exchange.mockRejectedValue(new Error("provider unavailable"));
    const state = outcome === "state-error" ? "mismatch" : "state-123";
    const response = await GET(
      new Request(
        `https://untrusted.invalid/api/integrations/teams/consent/callback?code=test-code&state=${state}`,
      ),
    );
    expect(response.headers.get("location")).toBe(
      `https://app.example.com/starter/admin/integrations/teams?tab=consent&teamsConsent=${outcome}`,
    );
    expect(cookieStore.delete).toHaveBeenCalled();
    if (outcome === "connected") expect(save).toHaveBeenCalledOnce();
    else expect(save).not.toHaveBeenCalled();
    if (outcome === "state-error") expect(exchange).not.toHaveBeenCalled();
  },
);

it("preserves colons in a local return path query and its fragment", async () => {
  cookieStore.get.mockReturnValue({
    value:
      "state-123:/starter/admin/integrations/teams?next=https://app.example.com/docs#details",
  });
  const response = await GET(
    new Request(
      "https://untrusted.invalid/callback?code=test-code&state=state-123",
    ),
  );
  const target = new URL(response.headers.get("location")!);
  expect(target.searchParams.get("next")).toBe("https://app.example.com/docs");
  expect(target.searchParams.get("teamsConsent")).toBe("connected");
  expect(target.hash).toBe("#details");
});
