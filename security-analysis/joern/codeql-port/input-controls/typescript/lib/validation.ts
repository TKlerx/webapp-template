import { jsonError } from "@/lib/http";
import { z } from "zod";

export async function parseFormBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: Response }> {
  try {
    const form = await request.formData();
    const entries = Array.from(form.entries());
    if (new Set(entries.map(([key]) => key)).size !== entries.length) {
      return { error: jsonError("Invalid request body", 400) };
    }
    const parsed = schema.safeParse(Object.fromEntries(entries));
    return parsed.success
      ? { data: parsed.data }
      : { error: jsonError("Invalid request body", 400) };
  } catch {
    return { error: jsonError("Invalid form body", 400) };
  }
}

export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
  validationMessage:
    | string
    | ((error: z.ZodError, value: unknown) => string) = "Invalid request body",
): Promise<{ data: z.infer<T> } | { error: Response }> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return { error: jsonError("Invalid JSON body", 400) };
  }

  const parsed = schema.safeParse(value);
  const hasUnknownKeys =
    !parsed.success &&
    parsed.error.issues.some((issue) => issue.code === "unrecognized_keys");
  return parsed.success
    ? { data: parsed.data }
    : {
        error: jsonError(
          hasUnknownKeys
            ? "Invalid request body"
            : typeof validationMessage === "function"
              ? validationMessage(parsed.error, value)
              : validationMessage,
          400,
        ),
      };
}
