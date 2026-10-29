import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { parseJsonBody } from "@/lib/validation";
import { deliverTeamsMessage } from "@/services/teams/service";

const bodySchema = z.object({ jobId: z.string().min(1).max(200) }).strict();

export async function POST(request: Request) {
  const secret = process.env.TEAMS_DELIVERY_SHARED_SECRET?.trim();
  if (!secret || secret.length < 32)
    return jsonError("Teams delivery is not configured", 503);
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return jsonError("Unauthorized", 401);
  }
  const parsed = await parseJsonBody(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  try {
    return Response.json(await deliverTeamsMessage(parsed.data.jobId));
  } catch {
    // Provider error bodies can contain tokens or tenant data; never relay them.
    return jsonError(
      "Teams delivery failed; check consent, target and integration settings",
      502,
    );
  }
}
