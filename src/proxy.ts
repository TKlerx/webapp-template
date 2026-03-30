import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getScopedCookiePath } from "@/lib/azure-auth";
import { auth, getBetterAuthCookieNames } from "@/lib/better-auth";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";
import { createRequestId, logger } from "@/lib/logger";
import { AuthMethod, UserStatus } from "../generated/prisma/enums";

const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH ?? "";
const PUBLIC_PATHS = ["/login", "/pending", "/api/auth/login", "/api/auth/session", "/api/locale", "/"];
const cookiePath = getScopedCookiePath();
const proxyLogger = logger.child({ component: "proxy" });

function stripBasePath(pathname: string) {
  if (configuredBasePath && pathname.startsWith(configuredBasePath)) {
    const stripped = pathname.slice(configuredBasePath.length);
    return stripped || "/";
  }

  return pathname;
}

function deleteCookies(response: NextResponse, names: string[]) {
  for (const name of names) {
    response.cookies.delete({ name, path: cookiePath });
  }

  return response;
}

function shouldSkipLogging(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

function buildNextResponse(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? createRequestId();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("x-request-id", requestId);

  if (!shouldSkipLogging(request.nextUrl.pathname) && process.env.ENABLE_REQUEST_LOGGING !== "false") {
    proxyLogger.info("http.request", {
      requestId,
      method: request.method,
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      userAgent: request.headers.get("user-agent"),
    });
  }

  return response;
}

function redirectForUserStatus(
  request: NextRequest,
  pathname: string,
  user: { status: string; authMethod: string },
  cookieNames: string[],
) {
  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    const [pathOnly, queryString] = target.split("?");
    url.pathname = pathOnly;
    url.search = queryString ? `?${queryString}` : "";
    return url;
  };

  if (user.status === UserStatus.INACTIVE) {
    return deleteCookies(
      NextResponse.redirect(
        redirectTo(
          user.authMethod === AuthMethod.SSO || user.authMethod === AuthMethod.BOTH
            ? "/login?error=revoked"
            : "/login",
        ),
      ),
      cookieNames,
    );
  }

  if (user.status === UserStatus.PENDING_APPROVAL && pathname !== "/pending") {
    return NextResponse.redirect(redirectTo("/pending"));
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const pathname = stripBasePath(request.nextUrl.pathname);
  const betterAuthCookieNames = getBetterAuthCookieNames();
  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";

    const [pathOnly, queryString] = target.split("?");
    url.pathname = pathOnly;
    url.search = queryString ? `?${queryString}` : "";
    return url;
  };

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/auth/") ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return buildNextResponse(request);
  }

  const hasBetterAuthCookie = betterAuthCookieNames.some((name) => request.cookies.has(name));
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  if (!hasBetterAuthCookie && !sessionToken && !pathname.startsWith("/api")) {
    const loginUrl = redirectTo("/login");
    return NextResponse.redirect(loginUrl);
  }

  if (hasBetterAuthCookie && !pathname.startsWith("/api")) {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return deleteCookies(NextResponse.redirect(redirectTo("/login")), betterAuthCookieNames);
    }

    const restricted = redirectForUserStatus(request, pathname, session.user, betterAuthCookieNames);
    if (restricted) {
      return restricted;
    }
  }

  if (sessionToken && !pathname.startsWith("/api")) {
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (!session || session.expiresAt <= new Date()) {
      return deleteCookies(NextResponse.redirect(redirectTo("/login")), [SESSION_COOKIE]);
    }

    const restricted = redirectForUserStatus(request, pathname, session.user, [SESSION_COOKIE]);
    if (restricted) {
      return restricted;
    }
  }

  return buildNextResponse(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
