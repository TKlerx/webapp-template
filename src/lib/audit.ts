import { prisma } from "@/lib/db";
import { AuditAction } from "../../generated/prisma/enums";

type LogAuditInput = {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorId: string;
  details?: unknown;
  scopeId?: string | null;
};

export async function logAudit(input: LogAuditInput) {
  return prisma.auditEntry.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId,
      scopeId: input.scopeId ?? null,
      details: JSON.stringify(input.details ?? {}),
    },
  });
}
