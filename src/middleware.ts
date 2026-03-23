import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestId, logger } from "@/lib/logger";

const middlewareLogger = logger.child({ component: "middleware" });

function shouldSkipLogging(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

export function middleware(request: NextRequest) {
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
    middlewareLogger.info("http.request", {
      requestId,
      method: request.method,
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      userAgent: request.headers.get("user-agent"),
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
