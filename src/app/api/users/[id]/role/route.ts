import { updateManagedUserRole } from "@/services/api/user-admin";
import { Role } from "../../../../../../generated/prisma/enums";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const roleBodySchema = z.object({ role: z.enum(Role) }).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = await parseJsonBody(
    request,
    roleBodySchema,
    (_error, value) =>
      typeof value === "object" && value !== null && "role" in value
        ? "Invalid role"
        : "Role is required",
  );
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;
  const result = await updateManagedUserRole(params, body, request);
  if ("error" in result) {
    return result.error;
  }

  return Response.json({ user: result.user });
}
