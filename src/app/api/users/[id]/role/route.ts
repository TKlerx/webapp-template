import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireApiUserWithRoles } from "@/lib/route-auth";
import { Role, UserStatus } from "../../../../../../generated/prisma/enums";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUserWithRoles([Role.GVI_FINANCE_ADMIN]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = (await request.json()) as { role?: Role };
  if (!body.role) return jsonError("Role is required", 400);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return jsonError("User not found", 404);

  if (user.role === Role.GVI_FINANCE_ADMIN && body.role !== Role.GVI_FINANCE_ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: Role.GVI_FINANCE_ADMIN, status: { not: UserStatus.INACTIVE } },
    });
    if (adminCount <= 1) {
      return jsonError("Cannot change role of the last Admin user", 400);
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: body.role },
  });

  return Response.json({ user: { id: updated.id, role: updated.role } });
}

