import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { Role } from "../../../generated/prisma/enums";
import type { SessionUser } from "@/lib/auth";

export type CreateBackgroundJobBody = {
  jobType?: string;
  payload?: unknown;
};

export function safeParseJobJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function listBackgroundJobsForUser(user: SessionUser) {
  const jobs = await prisma.backgroundJob.findMany({
    where: user.role === Role.PLATFORM_ADMIN ? undefined : { createdByUserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return jobs.map((job) => ({
    id: job.id,
    jobType: job.jobType,
    status: job.status,
    payload: safeParseJobJson(job.payload),
    result: safeParseJobJson(job.result),
    error: job.error,
    attemptCount: job.attemptCount,
    availableAt: job.availableAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    workerId: job.workerId,
    createdByUserId: job.createdByUserId,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }));
}

export async function createBackgroundJobForUser(userId: string, body: CreateBackgroundJobBody) {
  if (!body.jobType?.trim()) {
    return { error: jsonError("jobType is required", 400) };
  }

  const job = await prisma.backgroundJob.create({
    data: {
      jobType: body.jobType.trim(),
      payload: JSON.stringify(body.payload ?? {}),
      createdByUserId: userId,
    },
  });

  return {
    job: {
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      payload: safeParseJobJson(job.payload),
      createdAt: job.createdAt,
    },
  };
}
