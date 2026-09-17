import { jsonError } from "@/lib/http";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { cleanupExpiredCodes, exchangeAuthCode } from "@/services/api/cli-auth";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const cliAuthTokenBodySchema = z
  .object({
    code: z.string().min(1),
    state: z.string().min(1),
  })
  .strict();

function getTokenRateLimitKey(request: Request, code?: string, state?: string) {
  const clientIp = getClientIp(request);
  if (clientIp !== "unknown") {
    return `ip:${clientIp}`;
  }

  if (code?.trim()) {
    return `code:${code.trim().slice(0, 128)}`;
  }

  if (state?.trim()) {
    return `state:${state.trim().slice(0, 128)}`;
  }

  return "request:missing-code-state";
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(
    request,
    cliAuthTokenBodySchema,
    "code and state are required",
  );
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const rateLimit = checkRateLimit(
    getTokenRateLimitKey(request, body.code, body.state),
    "cli-auth-token",
  );
  if (!rateLimit.allowed) {
    const response = jsonError(
      "Too many attempts. Please try again later.",
      429,
    );
    response.headers.set(
      "Retry-After",
      Math.ceil(rateLimit.retryAfterMs / 1000).toString(),
    );
    return response;
  }

  await cleanupExpiredCodes();
  const result = await exchangeAuthCode(body.code, body.state);
  if ("error" in result) {
    return result.error;
  }

  return Response.json(result);
}
