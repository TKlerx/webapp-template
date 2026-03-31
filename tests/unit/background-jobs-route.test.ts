import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { Role } from "../../generated/prisma/enums";

const { requireApiUser } = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/route-auth", () => ({
  requireApiUser,
}));

import { GET, POST } from "@/app/api/background-jobs/route";

describe("background jobs route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new background job for the current user", async () => {
    requireApiUser.mockResolvedValue({
      user: { id: "user-1", role: Role.SCOPE_USER },
    });

    prismaMock.backgroundJob.create.mockResolvedValue({
      id: "job-1",
      jobType: "echo",
      status: "PENDING",
      payload: "{\"message\":\"hello\"}",
      result: null,
      error: null,
      attemptCount: 0,
      availableAt: new Date("2026-03-31T00:00:00Z"),
      startedAt: null,
      lockedAt: null,
      finishedAt: null,
      workerId: null,
      createdByUserId: "user-1",
      createdAt: new Date("2026-03-31T00:00:00Z"),
      updatedAt: new Date("2026-03-31T00:00:00Z"),
    } as never);

    const response = await POST(new Request("http://localhost/api/background-jobs", {
      method: "POST",
      body: JSON.stringify({
        jobType: "echo",
        payload: { message: "hello" },
      }),
      headers: {
        "content-type": "application/json",
      },
    }));

    if (!response) {
      throw new Error("Expected response");
    }

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      job: {
        id: "job-1",
        jobType: "echo",
        status: "PENDING",
        payload: { message: "hello" },
      },
    });
  });

  it("lists the current user's jobs", async () => {
    requireApiUser.mockResolvedValue({
      user: { id: "user-1", role: Role.SCOPE_USER },
    });

    prismaMock.backgroundJob.findMany.mockResolvedValue([
      {
        id: "job-1",
        jobType: "noop",
        status: "COMPLETED",
        payload: "{}",
        result: "{\"message\":\"done\"}",
        error: null,
        attemptCount: 1,
        availableAt: new Date("2026-03-31T00:00:00Z"),
        startedAt: new Date("2026-03-31T00:00:01Z"),
        lockedAt: new Date("2026-03-31T00:00:01Z"),
        finishedAt: new Date("2026-03-31T00:00:02Z"),
        workerId: "worker-1",
        createdByUserId: "user-1",
        createdAt: new Date("2026-03-31T00:00:00Z"),
        updatedAt: new Date("2026-03-31T00:00:02Z"),
      },
    ] as never);

    const response = await GET();

    if (!response) {
      throw new Error("Expected response");
    }

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jobs: [
        {
          id: "job-1",
          jobType: "noop",
          status: "COMPLETED",
          result: { message: "done" },
          workerId: "worker-1",
        },
      ],
    });
  });
});
