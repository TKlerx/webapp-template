import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { getAuthBaseUrl, getScopedCookiePath } from "@/lib/azure-auth";

export const TEAMS_CONSENT_STATE_COOKIE = "starter_app_teams_consent_state";
const TEAMS_DELEGATED_SCOPE = "offline_access ChannelMessage.Send";

type TeamsTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

export function createTeamsConsentState() {
  return crypto.randomBytes(24).toString("hex");
}

export function getTeamsConsentRedirectUri(request: Request) {
  return `${getAuthBaseUrl(request)}/api/integrations/teams/consent/callback`;
}

export function getTeamsConsentCookiePath() {
  return getScopedCookiePath();
}

export function getTeamsAuthorizeUrl(request: Request, state: string) {
  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  if (!tenantId || !clientId) {
    throw new Error("Azure AD configuration is incomplete.");
  }

  const authorizeUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", getTeamsConsentRedirectUri(request));
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("scope", TEAMS_DELEGATED_SCOPE);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "consent");
  return authorizeUrl;
}

export async function exchangeTeamsConsentCode(request: Request, code: string) {
  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Azure AD configuration is incomplete.");
  }

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: getTeamsConsentRedirectUri(request),
      scope: TEAMS_DELEGATED_SCOPE,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Teams consent token exchange failed: ${response.status} ${details}`);
  }

  return (await response.json()) as TeamsTokenResponse;
}

export async function saveTeamsDelegatedGrant(
  userId: string,
  token: TeamsTokenResponse,
) {
  const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;
  return prisma.teamsDelegatedGrant.upsert({
    where: { userId },
    update: {
      scope: token.scope ?? TEAMS_DELEGATED_SCOPE,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt,
    },
    create: {
      userId,
      scope: token.scope ?? TEAMS_DELEGATED_SCOPE,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt,
    },
  });
}

export async function getTeamsDelegatedGrantStatus(userId: string) {
  const grant = await prisma.teamsDelegatedGrant.findUnique({
    where: { userId },
    select: {
      id: true,
      scope: true,
      expiresAt: true,
      updatedAt: true,
    },
  });
  if (!grant) {
    return {
      connected: false,
      scope: null,
      expiresAt: null,
      updatedAt: null,
    };
  }

  return {
    connected: true,
    scope: grant.scope,
    expiresAt: grant.expiresAt,
    updatedAt: grant.updatedAt,
  };
}

export async function getFreshTeamsDelegatedAccessToken(userId: string) {
  const grant = await prisma.teamsDelegatedGrant.findUnique({
    where: { userId },
  });
  if (!grant) {
    return null;
  }

  if (grant.expiresAt && grant.expiresAt.getTime() > Date.now() + 60_000) {
    return grant.accessToken;
  }

  if (!grant.refreshToken) {
    return null;
  }

  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Azure AD configuration is incomplete.");
  }

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: grant.refreshToken,
      scope: TEAMS_DELEGATED_SCOPE,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Teams refresh token exchange failed: ${response.status} ${details}`);
  }

  const token = (await response.json()) as TeamsTokenResponse;
  await saveTeamsDelegatedGrant(userId, token);
  return token.access_token;
}
