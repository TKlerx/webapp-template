import { requireApiUser, requireApiUserWithRoles } from "@/lib/route-auth";
import { Role } from "../../../../generated/prisma/enums";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const backgroundJobBodySchema = z.object({
  jobType: z.string().optional(),
  payload: z.unknown().optional(),
});
import {
  createBackgroundJobForUser,
  listBackgroundJobsForUser,
} from "@/services/api/background-jobs";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if ("error" in auth) {
    return auth.error;
  }

  const jobs = await listBackgroundJobsForUser(auth.user);

  return Response.json({
    jobs,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) {
    return auth.error;
  }

  const parsed = await parseJsonBody(request, backgroundJobBodySchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;
  const result = await createBackgroundJobForUser(auth.user.id, body);
  if ("error" in result) {
    return result.error;
  }

  return Response.json({ job: result.job }, { status: 201 });
}
