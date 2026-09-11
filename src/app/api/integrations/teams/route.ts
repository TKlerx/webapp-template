import { requireApiUserWithRoles } from "@/lib/route-auth";
import {
  getIntegrationStatus,
  updateTeamsConfig,
} from "@/services/teams/admin";
import { Role } from "../../../../../generated/prisma/enums";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const teamsConfigBodySchema = z.object({
  sendEnabled: z.boolean().optional(),
  intakeEnabled: z.boolean().optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) {
    return auth.error;
  }

  const status = await getIntegrationStatus();
  return Response.json(status);
}

export async function PUT(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) {
    return auth.error;
  }

  const parsed = await parseJsonBody(request, teamsConfigBodySchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  await updateTeamsConfig({
    actorId: auth.user.id,
    sendEnabled: body.sendEnabled,
    intakeEnabled: body.intakeEnabled,
  });

  const status = await getIntegrationStatus();
  return Response.json(status);
}
