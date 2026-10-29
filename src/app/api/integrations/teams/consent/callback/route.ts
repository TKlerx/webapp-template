import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeLocalRedirectPath } from "@/lib/local-redirect";
import { getAbsoluteAppUrl } from "@/lib/better-auth-route";
import { requireApiUserWithRoles } from "@/lib/route-auth";
import {
  exchangeTeamsConsentCode,
  getTeamsConsentAppRedirectPath,
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

  const [expectedState] = cookieValue.split(":", 1);
  const redirectTo = safeLocalRedirectPath(
    cookieValue.slice(expectedState.length + 1),
  );
  const safeRedirect = redirectTo
    ? getTeamsConsentAppRedirectPath(redirectTo)
    : "/admin/integrations/teams";
  const finalRedirect = getTeamsConsentAppRedirectPath(safeRedirect);
  function redirectWithOutcome(outcome: string) {
    const target = new URL(getAbsoluteAppUrl(finalRedirect));
    target.searchParams.set("teamsConsent", outcome);
    return NextResponse.redirect(target);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithOutcome("state-error");
  }

  try {
    const token = await exchangeTeamsConsentCode(request, code);
    await saveTeamsDelegatedGrant(auth.user.id, token);
    return redirectWithOutcome("connected");
  } catch {
    return redirectWithOutcome("failed");
  }
}
