import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireApiUser } from "@/lib/route-auth";
import { jsonError } from "@/lib/http";
import { changePasswordForUser } from "@/services/api/auth";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(1),
  })
  .strict();

export async function POST(request: Request) {
  const authResult = await requireApiUser();
  if ("error" in authResult) return authResult.error;
  const user = authResult.user;

  const clientIp = getClientIp(request);
  const bucketKey =
    clientIp === "unknown" ? `user:${user.id}` : `ip:${clientIp}`;
  const rateLimit = checkRateLimit(bucketKey, "change-password");
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

  const parsed = await parseJsonBody(
    request,
    changePasswordBodySchema,
    "Current and new password are required",
  );
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;
  return changePasswordForUser(request, user, body);
}
