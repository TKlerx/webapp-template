import { z } from "zod";
import { jsonError } from "@/lib/http";
import {
  createAssistantTools,
  readAssistantRequest,
} from "@/services/assistant";

const toolRequest = z
  .object({ name: z.string().max(50), arguments: z.unknown() })
  .strict();

// Realtime tool calls use the same server-owned tools as text chat. Every call
// rechecks the current session; browser-supplied tool results carry no authority.
export async function POST(request: Request) {
  const input = await readAssistantRequest(request);
  if ("error" in input) return input.error;
  let body: unknown;
  try {
    body = JSON.parse(input.text);
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const parsed = toolRequest.safeParse(body);
  if (!parsed.success) return jsonError("Invalid tool request", 400);
  const definition = Object.entries(createAssistantTools(input.user)).find(
    ([name]) => name === parsed.data.name,
  )?.[1];
  if (!definition) return jsonError("Unknown tool", 400);
  // All shared tools declare Zod schemas; validate before selecting an execute union.
  const args = (definition.inputSchema as z.ZodType).safeParse(
    parsed.data.arguments,
  );
  if (!args.success) return jsonError("Invalid tool arguments", 400);
  try {
    const output: unknown = await definition.execute!(args.data as never, {
      toolCallId: "realtime",
      messages: [],
      context: {},
    });
    return Response.json(
      { output },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return jsonError("Tool is unavailable", 503);
  }
}
