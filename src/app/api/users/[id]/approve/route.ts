import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireManagedUser } from "@/lib/user-management";
import { UserStatus } from "../../../../../../generated/prisma/enums";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const managed = await requireManagedUser(params);
  if ("error" in managed) return managed.error;
  const { user } = managed;
  if (user.status !== UserStatus.PENDING_APPROVAL) {
    return jsonError("User is not in pending approval status", 400);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: UserStatus.ACTIVE },
  });

  return Response.json({ user: { id: updated.id, status: updated.status } });
}

