import { getSessionUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { requireCountryAccess, requireRole } from "@/lib/rbac";
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

export function ensureRoles(user: { role: Role }, roles: Role[]) {
  try {
    requireRole(user, roles);
    return null;
  } catch {
    return jsonError("Not authorized", 403);
  }
}

export async function requireApiUserWithRoles(roles: Role[]) {
  return authorizeRoute(new Request("http://localhost"), { roles });
}

type AuthorizeRouteOptions = {
  roles?: Role[];
  countryScoped?: boolean;
  countryId?: string | null;
  resolveCountryId?: ((request: Request) => Promise<string | null> | string | null) | null;
};

async function getCountryId(request: Request, options: AuthorizeRouteOptions) {
  if (options.countryId) {
    return options.countryId;
  }

  if (options.resolveCountryId) {
    return await options.resolveCountryId(request);
  }

  return new URL(request.url).searchParams.get("countryId");
}

export async function authorizeRoute(request: Request, options: AuthorizeRouteOptions = {}) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth;
  }

  if (options.roles?.length) {
    const denied = ensureRoles(auth.user, options.roles);
    if (denied) {
      return { error: denied };
    }
  }

  if (options.countryScoped) {
    const countryId = await getCountryId(request, options);

    if (!countryId) {
      return { error: jsonError("Country ID is required", 400) };
    }

    try {
      await requireCountryAccess(auth.user, countryId);
    } catch {
      return { error: jsonError("Not authorized for this country", 403) };
    }
  }

  return { user: auth.user };
}

