import { afterEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/lib/__mocks__/db";
import { AuditAction, Role } from "../../generated/prisma/enums";

const { requireApiUserWithRoles } = vi.hoisted(() => ({
  requireApiUserWithRoles: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/route-auth", () => ({
  requireApiUserWithRoles,
}));

import { exportToCSV, exportToPDF } from "@/lib/audit-export";
import { GET } from "@/app/api/audit/route";

describe("audit export", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exports CSV with the expected fields", async () => {
    prismaMock.auditEntry.count.mockResolvedValue(1);
    prismaMock.auditEntry.findMany.mockResolvedValue([
      {
        id: "audit-1",
        action: AuditAction.USER_CREATED,
        entityType: "user",
        entityId: "user-1",
        details: '{"role":"SCOPE_USER"}',
        createdAt: new Date("2026-03-21T00:00:00Z"),
        actor: {
          id: "user-1",
          name: "Audit Admin",
          email: "audit@example.com",
          role: Role.PLATFORM_ADMIN,
        },
        scope: {
          id: "scope-1",
          name: "Kenya",
          code: "KE",
        },
      },
    ] as never);

    const csv = await exportToCSV();

    expect(csv.toString("utf8")).toContain("USER_CREATED");
    expect(csv.toString("utf8")).toContain("audit@example.com");
  });

  it("exports a PDF buffer", async () => {
    prismaMock.auditEntry.count.mockResolvedValue(0);
    prismaMock.auditEntry.findMany.mockResolvedValue([] as never);

    const pdf = await exportToPDF();

    expect(pdf.toString("utf8")).toContain("%PDF-1.4");
  });

  it("returns paginated audit data from the API route", async () => {
    requireApiUserWithRoles.mockResolvedValue({
      user: { id: "admin-1", role: Role.PLATFORM_ADMIN },
    });
    prismaMock.auditEntry.count.mockResolvedValue(0);
    prismaMock.auditEntry.findMany.mockResolvedValue([] as never);

    const response = await GET(
      new Request("http://localhost/api/audit?page=2&limit=10"),
    );
    if (!response) {
      throw new Error("Expected response");
    }

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      total: 0,
      page: 2,
      limit: 10,
    });
  });
});
