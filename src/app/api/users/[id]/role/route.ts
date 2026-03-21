import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { ensureAdminUserCanChange, requireManagedUser } from "@/lib/user-management";
import { Role, UserStatus } from "../../../../../../generated/prisma/enums";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = (await request.json()) as { role?: Role };
  if (!body.role) return jsonError("Role is required", 400);

  const managed = await requireManagedUser(params);
  if ("error" in managed) return managed.error;
  const { user } = managed;

  const denied = await ensureAdminUserCanChange(user, {
    role: body.role,
    message: "Cannot change role of the last Admin user",
  });
  if (denied) return denied;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: body.role },
  });

  return Response.json({ user: { id: updated.id, role: updated.role } });
}

