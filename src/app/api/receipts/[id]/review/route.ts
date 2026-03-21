import { jsonError } from "@/lib/http";
import { requireApiUserWithRoles } from "@/lib/route-auth";
import { applyReviewAction } from "@/lib/review";
import { ReviewStatus, Role } from "../../../../../../generated/prisma/enums";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUserWithRoles([Role.GVI_FINANCE_ADMIN]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as { status?: ReviewStatus; comment?: string };
  if (!body.status) {
    return jsonError("Review status is required", 400);
  }

  if (!Object.values(ReviewStatus).includes(body.status)) {
    return jsonError("Invalid review status", 400);
  }

  const { id } = await params;
  const result = await applyReviewAction({
    receiptId: id,
    nextStatus: body.status,
    userId: auth.user.id,
    userRole: auth.user.role,
    comment: body.comment,
  });

  if ("error" in result) {
    return result.error;
  }

  return Response.json({
    data: {
      receipt: result.receipt,
      comment: result.comment,
    },
  });
}
