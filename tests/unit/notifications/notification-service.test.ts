import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { Role, UserStatus } from "../../../generated/prisma/enums";

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

import {
  queueRoleChangedNotifications,
  queueUserCreatedNotifications,
} from "@/services/notifications/service";

describe("notification service", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("queues user-created notifications for the affected user and active admins", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "admin-2",
        email: "admin@example.com",
        name: "Admin Two",
        locale: "de",
        role: Role.PLATFORM_ADMIN,
        status: UserStatus.ACTIVE,
        createdAt: new Date("2026-04-19T10:00:00Z"),
      },
    ] as never);
    prismaMock.notificationEvent.create.mockResolvedValue({ id: "event-1" } as never);
    prismaMock.notification.create
      .mockResolvedValueOnce({ id: "notification-1" } as never)
      .mockResolvedValueOnce({ id: "notification-2" } as never);
    prismaMock.backgroundJob.create.mockResolvedValue({ id: "job-1" } as never);

    await queueUserCreatedNotifications({
      actorId: "admin-1",
      user: {
        id: "user-1",
        email: "new.user@example.com",
        name: "New User",
        locale: "en",
        role: Role.SCOPE_USER,
        status: UserStatus.ACTIVE,
      },
    });

    expect(prismaMock.notificationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "USER_CREATED",
        actorId: "admin-1",
        affectedUserId: "user-1",
      }),
    });
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.backgroundJob.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.backgroundJob.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          jobType: "notification_delivery",
          createdByUserId: "admin-1",
          payload: expect.stringContaining('"notificationId":"notification-1"'),
        }),
      }),
    );
  });

  it("deduplicates recipients and stores role-change notifications", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "admin-2",
        email: "member@example.com",
        name: "Also Member",
        locale: "fr",
        role: Role.PLATFORM_ADMIN,
        status: UserStatus.ACTIVE,
        createdAt: new Date("2026-04-19T10:00:00Z"),
      },
    ] as never);
    prismaMock.notificationEvent.create.mockResolvedValue({ id: "event-2" } as never);
    prismaMock.notification.create.mockResolvedValue({ id: "notification-3" } as never);
    prismaMock.backgroundJob.create.mockResolvedValue({ id: "job-3" } as never);

    await queueRoleChangedNotifications({
      actorId: "admin-1",
      user: {
        id: "user-2",
        email: "member@example.com",
        name: "Scoped Member",
        locale: "en",
        role: Role.SCOPE_ADMIN,
        status: UserStatus.ACTIVE,
      },
      previousRole: Role.SCOPE_USER,
      nextRole: Role.SCOPE_ADMIN,
    });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.backgroundJob.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientEmail: "member@example.com",
        subject: expect.any(String),
      }),
    });
  });
});
