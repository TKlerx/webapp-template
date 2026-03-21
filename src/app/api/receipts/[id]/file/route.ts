import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { getSessionUser } from "@/lib/auth";
import { assertReceiptAccess } from "@/lib/receipts";
import { getFilePath } from "@/lib/file-storage";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/db";

function streamFromFile(path: string) {
  const stream = createReadStream(path);
  return new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => {
        if (typeof chunk === "string") {
          controller.enqueue(new TextEncoder().encode(chunk));
          return;
        }
        controller.enqueue(new Uint8Array(chunk));
      });
      stream.on("end", () => controller.close());
      stream.on("error", (error) => controller.error(error));
    },
    cancel() {
      stream.destroy();
    },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return jsonError("Not authenticated", 401);
  }

  try {
    const { id } = await params;
    const receipt = await assertReceiptAccess(user, id);
    const url = new URL(request.url);
    const revisionId = url.searchParams.get("revisionId");

    const fileRecord = revisionId
      ? await prisma.receiptRevision.findFirst({
          where: { id: revisionId, receiptId: receipt.id },
        })
      : receipt;

    if (!fileRecord) {
      return jsonError("File not found", 404);
    }

    const absolutePath = getFilePath(fileRecord.filePath);
    const fileStat = await stat(absolutePath);

    return new Response(streamFromFile(absolutePath), {
      headers: {
        "Content-Type": fileRecord.mimeType,
        "Content-Length": String(fileStat.size),
        "Content-Disposition": `inline; filename="${fileRecord.fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Receipt not found", 404);
    }
    return jsonError("Not authorized", 403);
  }
}
