import { requireApiUserWithRoles } from "@/lib/route-auth";
import {
  createIntakeSubscription,
  listIntakeSubscriptions,
} from "@/services/teams/admin";
import { Role } from "../../../../../../generated/prisma/enums";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const intakeSubscriptionBodySchema = z
  .object({
    teamId: z.string().trim().min(1),
    channelId: z.string().trim().min(1),
    teamName: z.string().optional(),
    channelName: z.string().optional(),
  })
  .strict();

export async function GET(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) {
    return auth.error;
  }

  const subscriptions = await listIntakeSubscriptions();
  return Response.json({ subscriptions });
}

export async function POST(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) {
    return auth.error;
  }

  const parsed = await parseJsonBody(
    request,
    intakeSubscriptionBodySchema,
    "teamId and channelId are required",
  );
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const result = await createIntakeSubscription({
    actorId: auth.user.id,
    teamId: body.teamId,
    channelId: body.channelId,
    teamName: body.teamName ?? null,
    channelName: body.channelName ?? null,
  });
  if ("error" in result) {
    return result.error;
  }

  return Response.json({ subscription: result }, { status: 201 });
}
