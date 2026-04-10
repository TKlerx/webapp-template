import { jsonError } from "@/lib/http";
import { cleanupExpiredCodes, exchangeAuthCode } from "@/services/api/cli-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { code?: string; state?: string };
  if (!body.code || !body.state) {
    return jsonError("code and state are required", 400);
  }

  await cleanupExpiredCodes();
  const result = await exchangeAuthCode(body.code, body.state);
  if ("error" in result) {
    return result.error;
  }

  return Response.json(result);
}
