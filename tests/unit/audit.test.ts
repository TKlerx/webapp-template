import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { AuditAction } from "../../generated/prisma/enums";

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

import { safeLogAudit } from "@/lib/audit";

describe("audit operational logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("persists an anonymous actor without inventing a user identity", async () => {
    prismaMock.auditEntry.create.mockResolvedValue({
      id: "audit-anonymous",
    } as never);
    await safeLogAudit({
      action: AuditAction.AUTH_LOGIN_REJECTED,
      actorId: null,
      entityType: "LoginAttempt",
      entityId: "attempt-1",
      details: { reason: "invalid_credentials" },
    });
    expect(prismaMock.auditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: null, entityId: "attempt-1" }),
    });
  });

  it("logs audit write failures while preserving audit persistence semantics", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.auditEntry.create.mockRejectedValue(new Error("db unavailable"));

    const result = await safeLogAudit({
      action: AuditAction.USER_CREATED,
      actorId: "admin-1",
      entityType: "user",
      entityId: "user-1",
      details: {
        userEmail: "person@example.com",
      },
    });

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const raw = String(errorSpy.mock.calls[0][0]);
    const payload = JSON.parse(raw);
    expect(payload).toMatchObject({
      event: "audit.write_failed",
      component: "audit",
      actorId: "admin-1",
      entityType: "user",
      entityId: "user-1",
    });
    expect(raw).not.toContain("person@example.com");
  });
});
