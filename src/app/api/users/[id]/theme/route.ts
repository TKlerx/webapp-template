import { jsonError } from "@/lib/http";
import { requireApiUser } from "@/lib/route-auth";
import { updateOwnThemePreference } from "@/services/api/user-admin";
import { ThemePreference } from "../../../../../../generated/prisma/enums";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const themeBodySchema = z
  .object({ themePreference: z.enum(ThemePreference) })
  .strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (auth.user.id !== id) return jsonError("Not authorized", 403);

  const parsed = await parseJsonBody(
    request,
    themeBodySchema,
    (_error, value) =>
      typeof value === "object" && value !== null && "themePreference" in value
        ? "Invalid theme preference"
        : "Theme preference is required",
  );
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;
  const result = await updateOwnThemePreference(id, body);
  if ("error" in result) {
    return result.error;
  }

  return Response.json({ themePreference: result.themePreference });
}
