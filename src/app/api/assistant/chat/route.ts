import { createAgentUIStreamResponse } from "ai";
import { assistantBodySchema } from "@/lib/assistant";
import { jsonError } from "@/lib/http";
import {
  assistantConfigured,
  createAssistant,
  readAssistantRequest,
} from "@/services/assistant";

export async function POST(request: Request) {
  const input = await readAssistantRequest(request);
  if ("error" in input) return input.error;
  let body: unknown;
  try {
    body = JSON.parse(input.text);
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const parsed = assistantBodySchema.safeParse(body);
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") {
    return jsonError("Invalid conversation", 400);
  }
  if (!assistantConfigured())
    return jsonError("Assistant is not configured", 503);
  try {
    return await createAgentUIStreamResponse({
      agent: createAssistant(input.user),
      uiMessages: parsed.data.messages,
      abortSignal: request.signal,
      timeout: 60_000,
      onError: () =>
        "The assistant could not complete this request. Please try again.",
    });
  } catch {
    return jsonError("Assistant is unavailable", 502);
  }
}
