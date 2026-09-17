import { requireApiUserWithRoles } from "@/lib/route-auth";
import {
  deleteDeliveryTarget,
  updateDeliveryTarget,
} from "@/services/teams/admin";
import { Role } from "../../../../../../../generated/prisma/enums";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const updateDeliveryTargetBodySchema = z
  .object({ name: z.string().optional(), active: z.boolean().optional() })
  .strict()
  .refine((body) => body.name !== undefined || body.active !== undefined);

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
    updateDeliveryTargetBodySchema,
    (error) =>
      error.issues[0]?.path[0] === "active"
        ? "active must be a boolean"
        : error.issues[0]?.code === "custom"
          ? "At least one field is required"
          : "Invalid request body",
  );
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const target = await updateDeliveryTarget(id, {
    name: body.name,
    active: body.active,
  });

  return Response.json({ target });
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
  const result = await deleteDeliveryTarget(id);
  if ("error" in result) {
    return result.error;
  }

  return new Response(null, { status: 204 });
}
