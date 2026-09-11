import { requireApiUserWithRoles } from "@/lib/route-auth";
import {
  createDeliveryTarget,
  listDeliveryTargets,
} from "@/services/teams/admin";
import { Role } from "../../../../../../generated/prisma/enums";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const deliveryTargetBodySchema = z.object({
  name: z.string().trim().min(1),
  teamId: z.string().trim().min(1),
  channelId: z.string().trim().min(1),
  teamName: z.string().optional(),
  channelName: z.string().optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) {
    return auth.error;
  }

  const targets = await listDeliveryTargets();
  return Response.json({ targets });
}

export async function POST(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) {
    return auth.error;
  }

  const parsed = await parseJsonBody(request, deliveryTargetBodySchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const result = await createDeliveryTarget({
    actorId: auth.user.id,
    name: body.name,
    teamId: body.teamId,
    channelId: body.channelId,
    teamName: body.teamName ?? null,
    channelName: body.channelName ?? null,
  });
  if ("error" in result) {
    return result.error;
  }

  return Response.json({ target: result }, { status: 201 });
}
