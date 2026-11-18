import { z } from "zod";

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
