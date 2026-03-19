import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { destroySession } from "@/lib/auth";
import { applySetCookieHeader } from "@/lib/better-auth-http";

export async function POST(request: Request) {
  const authResponse = await auth.api.signOut({
    headers: new Headers(request.headers),
    asResponse: true,
  });
  await destroySession();

  const url = new URL(request.url);
  const basePath = process.env.BASE_PATH ?? "";

  const response = NextResponse.redirect(new URL(`${basePath}/login`, url));
  return applySetCookieHeader(response, authResponse);
}

