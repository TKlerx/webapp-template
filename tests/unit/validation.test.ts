import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseFormBody, parseJsonBody } from "@/lib/validation";
import { apiErrorSchema, tokenActionResponseSchema } from "@/lib/api-response";

const schema = z.object({ name: z.string().min(1) }).strict();

describe("parseJsonBody", () => {
  it("returns parsed data for a valid JSON body", async () => {
    const result = await parseJsonBody(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "Ada" }),
      }),
      schema,
    );

    expect(result).toEqual({ data: { name: "Ada" } });
  });

  it.each([
    ["malformed JSON", "{", "Invalid JSON body"],
    ["invalid field type", '{"name":42}', "Name must be text"],
    ["unknown field", '{"name":"Ada","extra":true}', "Invalid request body"],
    ["mixed issues", '{"name":42,"extra":true}', "Invalid request body"],
  ])("returns the expected error for %s", async (_case, body, message) => {
    const result = await parseJsonBody(
      new Request("http://localhost", { method: "POST", body }),
      schema,
      "Name must be text",
    );

    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error.status).toBe(400);
      await expect(result.error.json()).resolves.toEqual({ error: message });
    }
  });

  it("passes ordinary schema issues to the custom formatter", async () => {
    const result = await parseJsonBody(
      new Request("http://localhost", { method: "POST", body: '{"name":42}' }),
      schema,
      (error, value) =>
        `Invalid ${error.issues[0].path.join(".")} in ${JSON.stringify(value)}`,
    );
    expect(result).toHaveProperty("error");
    if ("error" in result) {
      await expect(result.error.json()).resolves.toEqual({
        error: 'Invalid name in {"name":42}',
      });
    }
  });

  it.each([
    { body: null },
    { body: [] },
    { body: {} },
    { body: { name: 42 } },
    { body: { name: "" } },
    { body: { name: "Ada", admin: true } },
  ])(
    "rejects invalid or unexpected fields with HTTP 400: $body",
    async ({ body }) => {
      const result = await parseJsonBody(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify(body),
        }),
        schema,
      );
      expect(result).toHaveProperty("error");
      if ("error" in result) {
        expect(result.error.status).toBe(400);
        await expect(result.error.json()).resolves.toEqual({
          error: "Invalid request body",
        });
      }
    },
  );

  it("does not echo unexpected fields through a custom error formatter", async () => {
    const result = await parseJsonBody(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "Ada", secret: "do-not-echo" }),
      }),
      schema,
      (_error, value) => JSON.stringify(value),
    );
    expect(result).toHaveProperty("error");
    if ("error" in result) {
      await expect(result.error.json()).resolves.toEqual({
        error: "Invalid request body",
      });
    }
  });
});

describe("parseFormBody", () => {
  it("accepts distinct fields in the same form", async () => {
    const result = await parseFormBody(
      new Request("http://localhost", {
        method: "POST",
        body: new URLSearchParams({ name: "Ada", city: "Berlin" }),
      }),
      schema.extend({ city: z.string() }),
    );
    expect(result).toEqual({ data: { name: "Ada", city: "Berlin" } });
  });

  it.each([
    ["name=Ada", 200],
    ["name=Ada&name=Eve", 400],
    ["name=Ada&admin=true", 400],
    ["name=", 400],
    ["", 400],
  ])(
    "validates form fields without accepting duplicates: %s",
    async (body, status) => {
      const result = await parseFormBody(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        }),
        schema,
      );
      if (status === 200) {
        expect(result).toEqual({ data: { name: "Ada" } });
      } else {
        expect(result).toHaveProperty("error");
        if ("error" in result) {
          expect(result.error.status).toBe(400);
          await expect(result.error.json()).resolves.toEqual({
            error: "Invalid request body",
          });
        }
      }
    },
  );

  it("rejects an unreadable form body", async () => {
    const result = await parseFormBody(
      new Request("http://localhost", {
        method: "POST",
        body: "not-a-form",
      }),
      schema,
    );
    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error.status).toBe(400);
      await expect(result.error.json()).resolves.toEqual({
        error: "Invalid form body",
      });
    }
  });
});

it("validates API errors and token values before the UI uses them", () => {
  expect(apiErrorSchema.safeParse({ error: { message: "bad" } }).success).toBe(
    false,
  );
  expect(apiErrorSchema.safeParse({ error: "bad" }).success).toBe(true);
  expect(
    tokenActionResponseSchema.safeParse({ token: { tokenValue: 42 } }).success,
  ).toBe(false);
  expect(
    tokenActionResponseSchema.safeParse({
      token: { tokenValue: "value", name: "CLI" },
    }).success,
  ).toBe(true);
});
