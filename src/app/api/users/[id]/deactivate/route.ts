import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireApiUserWithRoles } from "@/lib/route-auth";
import { Role, UserStatus } from "../../../../../../generated/prisma/enums";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUserWithRoles([Role.GVI_FINANCE_ADMIN]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return jsonError("User not found", 404);

  if (user.role === Role.GVI_FINANCE_ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: Role.GVI_FINANCE_ADMIN, status: { not: UserStatus.INACTIVE } },
    });
    if (adminCount <= 1) {
      return jsonError("Cannot deactivate the last Admin user", 400);
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status: UserStatus.INACTIVE },
  });

  return Response.json({ user: { id: updated.id, status: updated.status } });
}

