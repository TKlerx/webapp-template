import { updateManagedUserStatus } from "@/lib/user-management";
import { UserStatus } from "../../../../../../generated/prisma/enums";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return updateManagedUserStatus(params, UserStatus.ACTIVE);
}

