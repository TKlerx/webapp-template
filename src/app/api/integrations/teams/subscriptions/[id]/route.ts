import { requireApiUserWithRoles } from "@/lib/route-auth";
import {
  deleteIntakeSubscription,
  updateIntakeSubscription,
} from "@/services/teams/admin";
import { Role } from "../../../../../../../generated/prisma/enums";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const updateIntakeSubscriptionBodySchema = z.object({
  active: z.boolean(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await params;
  const parsed = await parseJsonBody(
    request,
    updateIntakeSubscriptionBodySchema,
  );
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const subscription = await updateIntakeSubscription(id, {
    active: body.active,
  });

  return Response.json({ subscription });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await params;
  const result = await deleteIntakeSubscription(id);
  if ("error" in result) {
    return result.error;
  }

  return new Response(null, { status: 204 });
}
