import { jsonError } from "@/lib/http";
import { z } from "zod";
import {
  assistantInstructions,
  assistantAzureConfigured,
  assistantAzureHeaders,
  createAssistantTools,
  readAssistantRequest,
} from "@/services/assistant";

export async function POST(request: Request) {
  const input = await readAssistantRequest(request);
  if ("error" in input) return input.error;
  const resource = process.env.AZURE_OPENAI_RESOURCE_NAME;
  const model = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT;
  if (
    !resource ||
    !/^[a-z0-9-]+$/i.test(resource) ||
    !assistantAzureConfigured() ||
    !model
  ) {
    return jsonError("Voice is not configured", 503);
  }
  if (
    !input.text.startsWith("v=0") ||
    !request.headers.get("content-type")?.startsWith("application/sdp")
  ) {
    return jsonError("Invalid voice session", 400);
  }
  const endpoint = `https://${resource}.openai.azure.com/openai/v1/realtime`;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
  try {
    const authorization = await assistantAzureHeaders();
    const secretResponse = await fetch(`${endpoint}/client_secrets`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", ...authorization },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          instructions: assistantInstructions,
          output_modalities: ["audio"],
          max_output_tokens: 1500,
          tools: Object.entries(createAssistantTools(input.user)).map(
            ([name, definition]) => ({
              type: "function",
              name,
              description: definition.description,
              parameters: z.toJSONSchema(definition.inputSchema as z.ZodType),
            }),
          ),
          audio: {
            input: {
              transcription: { model: "whisper-1" },
              turn_detection: {
                type: "server_vad",
                create_response: true,
                interrupt_response: true,
                silence_duration_ms: 700,
              },
            },
            output: {
              voice: process.env.AZURE_OPENAI_REALTIME_VOICE || "marin",
            },
          },
        },
      }),
    });
    if (!secretResponse.ok)
      return jsonError("Voice service is unavailable", 502);
    // Upstream response, not an incoming request body.
    // eslint-disable-next-line no-restricted-syntax
    const secret: unknown = await secretResponse.json();
    if (
      !secret ||
      typeof secret !== "object" ||
      !("value" in secret) ||
      typeof secret.value !== "string"
    ) {
      return jsonError("Voice service is unavailable", 502);
    }
    const response = await fetch(`${endpoint}/calls`, {
      method: "POST",
      signal,
      body: input.text,
      headers: {
        Authorization: `Bearer ${secret.value}`,
        "Content-Type": "application/sdp",
      },
    });
    if (!response.ok)
      return jsonError("Voice session could not be started", 502);
    // Upstream SDP response; request SDP was bounded and checked above.
    // eslint-disable-next-line no-restricted-syntax
    return new Response(await response.text(), {
      status: 201,
      headers: {
        "Content-Type": "application/sdp",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError("Voice service is unavailable", 502);
  }
}
