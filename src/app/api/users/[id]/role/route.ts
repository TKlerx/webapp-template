import { updateManagedUserRole } from "@/services/api/user-admin";
import { Role } from "../../../../../../generated/prisma/enums";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const roleBodySchema = z.object({ role: z.enum(Role) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = await parseJsonBody(request, roleBodySchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;
  const result = await updateManagedUserRole(params, body, request);
  if ("error" in result) {
    return result.error;
  }

  return Response.json({ user: result.user });
}
