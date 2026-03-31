import { getSessionUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { checkScopeAccess, checkRole } from "@/lib/rbac";
import { Role } from "../../generated/prisma/enums";

export async function requireApiUser() {
  const user = await getSessionUser();

  if (!user) {
    return { error: jsonError("Not authenticated", 401) };
  }

  if (user.status === "PENDING_APPROVAL") {
    return { error: jsonError("Your account is pending approval", 403) };
  }

  return { user };
}

export async function requireApiUserWithRoles(roles: Role[]) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth;
  }

  if (!checkRole(auth.user, roles)) {
    return { error: jsonError("Not authorized", 403) };
  }

  return { user: auth.user };
}

type AuthorizeRouteOptions = {
  roles?: Role[];
  scopeRestricted?: boolean;
  scopeId?: string | null;
  resolveScopeId?: ((request: Request) => Promise<string | null> | string | null) | null;
};

async function getScopeId(request: Request, options: AuthorizeRouteOptions) {
  if (options.scopeId) {
    return options.scopeId;
  }

  if (options.resolveScopeId) {
    return await options.resolveScopeId(request);
  }

  return new URL(request.url).searchParams.get("scopeId");
}

export async function authorizeRoute(request: Request, options: AuthorizeRouteOptions = {}) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth;
  }

  if (options.roles?.length && !checkRole(auth.user, options.roles)) {
    return { error: jsonError("Not authorized", 403) };
  }

  if (options.scopeRestricted) {
    const scopeId = await getScopeId(request, options);

    if (!scopeId) {
      return { error: jsonError("Scope ID is required", 400) };
    }

    const hasAccess = await checkScopeAccess(auth.user, scopeId);
    if (!hasAccess) {
      return { error: jsonError("Not authorized for this scope", 403) };
    }
  }

  return { user: auth.user };
}
