import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const basePath = process.env.BASE_PATH ?? "";
  const callbackUrl = new URL(request.url);
  callbackUrl.pathname = `${basePath}/api/auth/callback/microsoft`;
  return NextResponse.redirect(callbackUrl);
}

export const POST = GET;
