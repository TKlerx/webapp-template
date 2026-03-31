import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireApiUser } from "@/lib/route-auth";
import { Role } from "../../../../generated/prisma/enums";

type CreateBackgroundJobBody = {
  jobType?: string;
  payload?: unknown;
};

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const jobs = await prisma.backgroundJob.findMany({
    where: auth.user.role === Role.PLATFORM_ADMIN ? undefined : { createdByUserId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return Response.json({
    jobs: jobs.map((job) => ({
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      payload: safeParseJson(job.payload),
      result: safeParseJson(job.result),
      error: job.error,
      attemptCount: job.attemptCount,
      availableAt: job.availableAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      workerId: job.workerId,
      createdByUserId: job.createdByUserId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as CreateBackgroundJobBody;
  if (!body.jobType?.trim()) {
    return jsonError("jobType is required", 400);
  }

  const job = await prisma.backgroundJob.create({
    data: {
      jobType: body.jobType.trim(),
      payload: JSON.stringify(body.payload ?? {}),
      createdByUserId: auth.user.id,
    },
  });

  return Response.json(
    {
      job: {
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        payload: safeParseJson(job.payload),
        createdAt: job.createdAt,
      },
    },
    { status: 201 },
  );
}

function safeParseJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
