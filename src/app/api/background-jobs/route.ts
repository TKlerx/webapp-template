import { requireApiUser } from "@/lib/route-auth";
import {
  createBackgroundJobForUser,
  listBackgroundJobsForUser,
} from "@/services/api/background-jobs";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const jobs = await listBackgroundJobsForUser(auth.user);

  return Response.json({
    jobs,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as {
    jobType?: string;
    payload?: unknown;
  };
  const result = await createBackgroundJobForUser(auth.user.id, body);
  if ("error" in result) {
    return result.error;
  }

  return Response.json({ job: result.job }, { status: 201 });
}
