import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireApiUser } from "@/lib/route-auth";
import { jsonError } from "@/lib/http";
import { changePasswordForUser } from "@/services/api/auth";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(getClientIp(request), "change-password");
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

  const authResult = await requireApiUser();
  if ("error" in authResult) return authResult.error;
  const user = authResult.user;

  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };
  return changePasswordForUser(request, user, body);
}
