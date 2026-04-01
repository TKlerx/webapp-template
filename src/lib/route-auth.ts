import {
  authorizeRouteContext,
  requireRouteUser,
  requireRouteUserWithRoles,
} from "@/services/api/route-context";
import { Role } from "../../generated/prisma/enums";
import type { AuthorizeRouteOptions } from "@/services/api/types";

export async function requireApiUser() {
  return requireRouteUser();
}

export async function requireApiUserWithRoles(roles: Role[]) {
  return requireRouteUserWithRoles(roles);
}

export async function authorizeRoute(request: Request, options: AuthorizeRouteOptions = {}) {
  return authorizeRouteContext(request, options);
}
