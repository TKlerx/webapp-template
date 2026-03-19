import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { requireApiUser } from "@/lib/route-auth";
import { ThemePreference } from "../../../../../../generated/prisma/enums";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (auth.user.id !== id) return jsonError("Not authorized", 403);

  const body = (await request.json()) as { themePreference?: ThemePreference };
  if (!body.themePreference) return jsonError("Theme preference is required", 400);

  const updated = await prisma.user.update({
    where: { id },
    data: { themePreference: body.themePreference },
  });

  return Response.json({ themePreference: updated.themePreference });
}

