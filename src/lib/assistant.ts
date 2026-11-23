import { z } from "zod";

// Persist text only: tool invocations, audio and system instructions cannot be replayed.
export const savedTurnsSchema = z
  .array(
    z
      .object({
        id: z.string().min(1).max(100),
        role: z.enum(["user", "assistant"]),
        text: z.string().min(1).max(6000),
      })
      .strict(),
  )
  .max(100);
export type SavedTurn = z.infer<typeof savedTurnsSchema>[number];
export const conversationSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  revision: z.number().int(),
  updatedAt: z.string(),
});
export const savedConversationSchema = conversationSummarySchema.extend({
  messages: savedTurnsSchema,
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type SavedConversation = z.infer<typeof savedConversationSchema>;

export const assistantPages = {
  dashboard: "/dashboard",
  jobs: "/background-jobs",
  audit: "/audit-trail",
  tokens: "/settings/tokens",
  documentation: "/docs/api",
} as const;

export const assistantPageSchema = z.enum([
  "dashboard",
  "jobs",
  "audit",
  "tokens",
  "documentation",
]);

export const assistantBodySchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            id: z.string().max(100),
            role: z.enum(["user", "assistant"]),
            parts: z
              .array(
                z
                  .object({
                    type: z.literal("text"),
                    text: z.string().max(6000),
                  })
                  .strict(),
              )
              .min(1)
              .max(8),
          })
          .strict(),
      )
      .min(1)
      .max(24),
  })
  .strict();

export const MAX_CHAT_REQUEST_BYTES = 64 * 1024;
