import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonBody } from "@/lib/validation";

const schema = z.object({ name: z.string().min(1) });

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
});
