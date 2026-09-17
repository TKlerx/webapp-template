import { requireApiUserWithRoles } from "@/lib/route-auth";
import {
  createLocalUser,
  listUsers,
  parseUserStatusFilter,
} from "@/services/api/user-admin";
import { Role } from "../../../../generated/prisma/enums";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const createUserBodySchema = z
  .object({
    email: z.string().trim().min(1),
    name: z.string().trim().min(1),
    role: z.enum(Role),
    temporaryPassword: z.string().min(1),
  })
  .strict();

export async function GET(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const parsedStatus = parseUserStatusFilter(url.searchParams.get("status"));
  if ("error" in parsedStatus) {
    return parsedStatus.error;
  }

  const users = await listUsers(parsedStatus.status);

  return Response.json({
    users,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, createUserBodySchema, (error) =>
    error.issues[0]?.path[0] === "role"
      ? "Invalid role"
      : "Email, name, role, and temporary password are required",
  );
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const result = await createLocalUser(auth.user.id, body);
  if ("error" in result) {
    return result.error;
  }

  return Response.json({ user: result.user }, { status: 201 });
}
