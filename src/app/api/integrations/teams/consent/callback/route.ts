import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireApiUserWithRoles } from "@/lib/route-auth";
import {
  exchangeTeamsConsentCode,
  getTeamsConsentCookiePath,
  saveTeamsDelegatedGrant,
  TEAMS_CONSENT_STATE_COOKIE,
} from "@/services/teams/consent";
import { Role } from "../../../../../../../generated/prisma/enums";

export async function GET(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) {
    return auth.error;
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(TEAMS_CONSENT_STATE_COOKIE)?.value ?? "";
  cookieStore.delete({
    name: TEAMS_CONSENT_STATE_COOKIE,
    path: getTeamsConsentCookiePath(),
  });

  const [expectedState, redirectToFromState] = cookieValue.split(":", 2);
  const safeRedirect =
    redirectToFromState && redirectToFromState.startsWith("/") && !redirectToFromState.startsWith("//")
      ? redirectToFromState
      : "/admin/integrations/teams";

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL(`${safeRedirect}?teamsConsent=state-error`, request.url));
  }

  try {
    const token = await exchangeTeamsConsentCode(request, code);
    await saveTeamsDelegatedGrant(auth.user.id, token);
    return NextResponse.redirect(new URL(`${safeRedirect}?teamsConsent=connected`, request.url));
  } catch {
    return NextResponse.redirect(new URL(`${safeRedirect}?teamsConsent=failed`, request.url));
  }
}
