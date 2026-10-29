import {
  auth,
  BETTER_AUTH_API_BASE_PATH,
  getConfiguredAuthBaseUrl,
} from "@/lib/better-auth";
import { getConfiguredBasePath } from "@/lib/azure-auth";
import { safeLocalRedirectPath } from "@/lib/local-redirect";

const STRIPPED_AUTH_BASE_PATH = "/api/auth";

function normalizeAuthRequest(request: Request) {
  const url = new URL(request.url);

  if (!url.pathname.startsWith(BETTER_AUTH_API_BASE_PATH)) {
    if (url.pathname.startsWith(STRIPPED_AUTH_BASE_PATH)) {
      url.pathname = `${BETTER_AUTH_API_BASE_PATH}${url.pathname.slice(STRIPPED_AUTH_BASE_PATH.length)}`;
    } else {
      url.pathname = `${BETTER_AUTH_API_BASE_PATH}${url.pathname}`;
    }
  }

  return new Request(url, request);
}

export function handleBetterAuthRoute(request: Request) {
  return auth.handler(normalizeAuthRequest(request));
}

export function getBetterAuthAbsolutePath(pathname: string) {
  return `${getConfiguredAuthBaseUrl()}${BETTER_AUTH_API_BASE_PATH}${pathname}`;
}

export function getAbsoluteAppUrl(pathname: string) {
  if (!safeLocalRedirectPath(pathname)) {
    throw new Error("Invalid local redirect path");
  }
  const configuredBasePath = getConfiguredBasePath();
  if (
    configuredBasePath &&
    (!safeLocalRedirectPath(configuredBasePath) ||
      /[?#]/.test(configuredBasePath))
  ) {
    throw new Error("Invalid app base path");
  }
  const basePath = configuredBasePath.replace(/\/+$/, "");
  const pathWithoutQuery = pathname.split(/[?#]/, 1)[0];
  const scopedPath =
    basePath &&
    (pathWithoutQuery === basePath ||
      pathWithoutQuery.startsWith(`${basePath}/`))
      ? pathname
      : `${basePath}${pathname}`;
  return `${getConfiguredAuthBaseUrl()}${scopedPath}`;
}
