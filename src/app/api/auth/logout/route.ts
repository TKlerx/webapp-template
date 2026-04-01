import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeLogAudit } from "@/lib/audit";
import { auth } from "@/lib/better-auth";
import { applySetCookieHeaders } from "@/lib/better-auth-http";
import { getConfiguredBasePath } from "@/lib/azure-auth";
import { AuditAction } from "../../../../../generated/prisma/enums";

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  const authResponse = await auth.api.signOut({
    headers: new Headers(request.headers),
    asResponse: true,
  });

  if (sessionUser) {
    await safeLogAudit({
      action: AuditAction.AUTH_LOGOUT_SUCCEEDED,
      entityType: "User",
      entityId: sessionUser.id,
      actorId: sessionUser.id,
    });
  }

  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL(`${getConfiguredBasePath()}/login`, url));
  return applySetCookieHeaders(response, authResponse);
}

