import { z } from "zod";

export const apiErrorSchema = z.object({ error: z.string().optional() });

export const tokenActionResponseSchema = apiErrorSchema.extend({
  token: z
    .object({ name: z.string().optional(), tokenValue: z.string().optional() })
    .optional(),
});
