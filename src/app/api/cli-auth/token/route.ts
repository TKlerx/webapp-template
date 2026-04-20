import { jsonError } from "@/lib/http";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { cleanupExpiredCodes, exchangeAuthCode } from "@/services/api/cli-auth";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(getClientIp(request), "cli-auth-token");
  if (!rateLimit.allowed) {
    const response = jsonError("Too many attempts. Please try again later.", 429);
    response.headers.set("Retry-After", Math.ceil(rateLimit.retryAfterMs / 1000).toString());
    return response;
  }

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
