import { jsonError } from "@/lib/http";
import { z } from "zod";

export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: Response }> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return { error: jsonError("Invalid JSON body", 400) };
  }

  const parsed = schema.safeParse(value);
  return parsed.success
    ? { data: parsed.data }
    : { error: jsonError("Invalid request body", 400) };
}
