import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

import {
  decryptGrantToken,
  encryptGrantToken,
  getFreshTeamsDelegatedAccessToken,
  saveTeamsDelegatedGrant,
} from "@/services/teams/consent";

describe("teams delegated grant token handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete process.env.TEAMS_DELEGATED_GRANT_ENCRYPTION_KEY;
  });

  it("encrypts and decrypts delegated grant tokens", () => {
    process.env.TEAMS_DELEGATED_GRANT_ENCRYPTION_KEY =
      "test-key-for-delegated-grants";
    const encrypted = encryptGrantToken("secret-token-value");

    expect(encrypted).toContain("enc:v1:");
    expect(encrypted).not.toContain("secret-token-value");
    expect(decryptGrantToken(encrypted)).toBe("secret-token-value");
  });

  it("stores encrypted delegated grant tokens at rest", async () => {
    process.env.TEAMS_DELEGATED_GRANT_ENCRYPTION_KEY =
      "test-key-for-delegated-grants";
    prismaMock.teamsDelegatedGrant.upsert.mockResolvedValue({
      id: "grant-1",
    } as never);

    await saveTeamsDelegatedGrant("user-1", {
      access_token: "access-plain",
      refresh_token: "refresh-plain",
      expires_in: 3600,
      scope: "offline_access ChannelMessage.Send",
    });

    expect(prismaMock.teamsDelegatedGrant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          accessToken: expect.stringContaining("enc:v1:"),
          refreshToken: expect.stringContaining("enc:v1:"),
        }),
      }),
    );
    expect(
      JSON.stringify(prismaMock.teamsDelegatedGrant.upsert.mock.calls[0][0]),
    ).not.toContain("access-plain");
  });

  it("returns decrypted access tokens for valid cached grants", async () => {
    process.env.TEAMS_DELEGATED_GRANT_ENCRYPTION_KEY =
      "test-key-for-delegated-grants";
    const encrypted = encryptGrantToken("cached-access-token");
    prismaMock.teamsDelegatedGrant.findUnique.mockResolvedValue({
      accessToken: encrypted,
      refreshToken: null,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    } as never);

    const token = await getFreshTeamsDelegatedAccessToken("user-1");

    expect(token).toBe("cached-access-token");
  });

  it("refreshes an expired grant without discarding an unchanged refresh token", async () => {
    process.env.TEAMS_DELEGATED_GRANT_ENCRYPTION_KEY = "test-grant-key";
    vi.stubEnv("AZURE_AD_CLIENT_ID", "cid");
    vi.stubEnv("AZURE_AD_CLIENT_SECRET", "secret");
    vi.stubEnv("AZURE_AD_TENANT_ID", "tenant");
    prismaMock.teamsDelegatedGrant.findUnique.mockResolvedValue({
      accessToken: encryptGrantToken("old"),
      refreshToken: encryptGrantToken("refresh-existing"),
      expiresAt: new Date(0),
    } as never);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ access_token: "fresh", expires_in: 3600 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    try {
      expect(await getFreshTeamsDelegatedAccessToken("owner")).toBe("fresh");
      const params = fetchMock.mock.calls[0][1].body as URLSearchParams;
      expect(params.get("grant_type")).toBe("refresh_token");
      expect(params.get("refresh_token")).toBe("refresh-existing");
      const saved =
        prismaMock.teamsDelegatedGrant.upsert.mock.calls[0][0].update;
      expect(decryptGrantToken(saved.refreshToken as string)).toBe(
        "refresh-existing",
      );
      expect(decryptGrantToken(saved.accessToken as string)).toBe("fresh");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
