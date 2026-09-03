import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
) as { dependencies?: Record<string, string> };

const prismaSchemas = [
  "prisma/schema.prisma",
  "prisma/schema.postgres.prisma",
].map((schemaPath) =>
  fs.readFileSync(path.resolve(process.cwd(), schemaPath), "utf8"),
);

describe("Better Auth dependency compatibility", () => {
  it("keeps Better Auth on the pre-1.7 account identity contract", () => {
    expect(packageJson.dependencies?.["better-auth"]).toMatch(/^1\.6\.\d+$/);

    for (const schema of prismaSchemas) {
      const accountModel = schema.match(/model Account \{[\s\S]*?\n\}/)?.[0];
      expect(accountModel).toBeDefined();
      expect(accountModel).toContain("accountId");
      expect(accountModel).not.toContain("issuer");
    }
  });
});
