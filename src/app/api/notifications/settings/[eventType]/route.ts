import { requireApiUserWithRoles } from "@/lib/route-auth";
import {
  parseNotificationEventType,
  updateNotificationTypeConfiguration,
} from "@/services/notifications/admin";
import { Role } from "../../../../../../generated/prisma/enums";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const notificationSettingsBodySchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventType: string }> },
) {
  const auth = await requireApiUserWithRoles([Role.PLATFORM_ADMIN], request);
  if ("error" in auth) {
    return auth.error;
  }

  const { eventType } = await params;
  const parsedEventType = parseNotificationEventType(eventType);
  if ("error" in parsedEventType) {
    return parsedEventType.error;
  }

  const parsedBody = await parseJsonBody(
    request,
    notificationSettingsBodySchema,
  );
  if ("error" in parsedBody) return parsedBody.error;
  const body = parsedBody.data;

  const result = await updateNotificationTypeConfiguration(
    parsedEventType.eventType!,
    auth.user.id,
    body.enabled,
  );
  if ("error" in result) {
    return result.error;
  }

  return Response.json({ config: result.config });
}
