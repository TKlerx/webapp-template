import { safeLogAudit } from "@/lib/audit";
import { jsonError } from "@/lib/http";
import { requireApiUser } from "@/lib/route-auth";
import { renewToken } from "@/services/api/tokens";
import { AuditAction } from "../../../../../../generated/prisma/enums";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const ALLOWED_EXPIRY_DAYS = [7, 30, 60, 90, 180, 365];
const renewTokenBodySchema = z
  .object({
    expiresInDays: z.number().int().optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const parsed = await parseJsonBody(
    request,
    renewTokenBodySchema,
    "Invalid expiration. Supported values: 7, 30, 60, 90, 180, 365",
  );
  if ("error" in parsed) return parsed.error;
  const { expiresInDays = 90 } = parsed.data;
  if (!ALLOWED_EXPIRY_DAYS.includes(expiresInDays)) {
    return jsonError(
      "Invalid expiration. Supported values: 7, 30, 60, 90, 180, 365",
      400,
    );
  }

  const { id } = await context.params;
  const result = await renewToken(id, auth.user.id, expiresInDays);
  if ("error" in result) {
    return result.error;
  }

  await safeLogAudit({
    action: AuditAction.PAT_RENEWED,
    entityType: "PersonalAccessToken",
    entityId: id,
    actorId: auth.user.id,
    details: {
      expiresAt: result.token.expiresAt,
      renewalCount: result.token.renewalCount,
    },
  });

  return Response.json({ token: result.token });
}
