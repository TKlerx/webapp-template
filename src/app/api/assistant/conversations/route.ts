import { z } from "zod";
import { prisma } from "@/lib/db";
import { savedTurnsSchema } from "@/lib/assistant";
import { jsonError } from "@/lib/http";
import {
  requireAssistantUser,
  readAssistantRequest,
} from "@/services/assistant";

const summary = {
  id: true,
  title: true,
  revision: true,
  updatedAt: true,
} as const;
const version = z
  .object({ id: z.uuid(), revision: z.number().int().nonnegative() })
  .strict();
const write = version.extend({ messages: savedTurnsSchema }).strict();
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const auth = await requireAssistantUser(request, "assistant-history");
    if ("error" in auth) return auth.error;
    const userId = auth.user.id;
    const id = new URL(request.url).searchParams.get("id");
    if (id !== null) {
      if (!z.uuid().safeParse(id).success)
        return jsonError("Invalid conversation", 400);
      const row = await prisma.assistantConversation.findFirst({
        where: { id, userId },
        select: { ...summary, messages: true },
      });
      return row
        ? Response.json(row, { headers })
        : jsonError("Conversation not found", 404);
    }
    return Response.json(
      await prisma.assistantConversation.findMany({
        where: { userId },
        select: summary,
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      { headers },
    );
  } catch {
    return jsonError("Conversation storage is unavailable", 503);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAssistantUser(request, "assistant-history");
    if ("error" in auth) return auth.error;
    return Response.json(
      await prisma.assistantConversation.create({
        data: { userId: auth.user.id, messages: [] },
        select: { ...summary, messages: true },
      }),
      { status: 201, headers },
    );
  } catch {
    return jsonError("Conversation storage is unavailable", 503);
  }
}

async function missingOrConflict(id: string, userId: string) {
  const owned = await prisma.assistantConversation.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  return owned
    ? jsonError(
        "Conversation changed in another tab. Reload the saved version.",
        409,
      )
    : jsonError("Conversation not found", 404);
}

export async function PATCH(request: Request) {
  try {
    const input = await readAssistantRequest(request, "assistant-history");
    if ("error" in input) return input.error;
    let body: unknown;
    try {
      body = JSON.parse(input.text);
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    const parsed = write.safeParse(body);
    if (!parsed.success) return jsonError("Invalid conversation", 400);
    const { id, revision, messages } = parsed.data;
    const rows = await prisma.assistantConversation.updateManyAndReturn({
      where: { id, userId: input.user.id, revision },
      data: {
        messages,
        title: Array.from(
          messages.find((turn) => turn.role === "user")?.text ?? "",
        )
          .slice(0, 100)
          .join(""),
        revision: { increment: 1 },
      },
      select: summary,
    });
    if (rows[0]) return Response.json(rows[0], { headers });
    const existing = await prisma.assistantConversation.findFirst({
      where: { id, userId: input.user.id, revision: revision + 1 },
      select: { ...summary, messages: true },
    });
    if (existing) {
      const { messages: current, ...currentSummary } = existing;
      const previous = savedTurnsSchema.safeParse(current);
      if (
        previous.success &&
        JSON.stringify(previous.data) === JSON.stringify(messages)
      ) {
        return Response.json(currentSummary, { headers });
      }
    }
    return missingOrConflict(id, input.user.id);
  } catch {
    return jsonError("Conversation storage is unavailable", 503);
  }
}

export async function DELETE(request: Request) {
  try {
    const input = await readAssistantRequest(request, "assistant-history");
    if ("error" in input) return input.error;
    let body: unknown;
    try {
      body = JSON.parse(input.text);
    } catch {
      return jsonError("Invalid JSON body", 400);
    }
    const parsed = version.safeParse(body);
    if (!parsed.success) return jsonError("Invalid conversation", 400);
    const { id, revision } = parsed.data;
    const result = await prisma.assistantConversation.deleteMany({
      where: { id, userId: input.user.id, revision },
    });
    return result.count
      ? new Response(null, { status: 204, headers })
      : await missingOrConflict(id, input.user.id);
  } catch {
    return jsonError("Conversation storage is unavailable", 503);
  }
}
