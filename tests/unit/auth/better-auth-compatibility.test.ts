import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getSchema } from "better-auth/db";

const prismaSchemas = ["prisma/schema.prisma"].map((schemaPath) =>
  fs.readFileSync(path.resolve(process.cwd(), schemaPath), "utf8"),
);

describe("Better Auth dependency compatibility", () => {
  it("supports the installed Better Auth account schema", () => {
    const fields = getSchema({}).account.fields;
    for (const schema of prismaSchemas) {
      const accountModel = schema.match(/model Account \{[\s\S]*?\n\}/)?.[0];
      expect(accountModel).toBeDefined();
      for (const [name, field] of Object.entries(fields)) {
        if (field.required && !field.defaultValue)
          expect(accountModel).toMatch(new RegExp(`\\b${name}\\s`));
      }
    }
  });
});
