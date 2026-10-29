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

  it("rejects invalid JSON and invalid data", async () => {
    const invalidJson = await parseJsonBody(
      new Request("http://localhost", { method: "POST", body: "{" }),
      schema,
    );
    const invalidData = await parseJsonBody(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: 42 }),
      }),
      schema,
    );

    expect(invalidJson).toHaveProperty("error");
    expect(invalidData).toHaveProperty("error");
  });

  it.each([
    null,
    [],
    {},
    { name: 42 },
    { name: "" },
    { name: "Ada", admin: true },
  ])("rejects invalid or unexpected fields with HTTP 400: %j", async (body) => {
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
  });

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
        if ("error" in result) expect(result.error.status).toBe(400);
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
    if ("error" in result) expect(result.error.status).toBe(400);
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
