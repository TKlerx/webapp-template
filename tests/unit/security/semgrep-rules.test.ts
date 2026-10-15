import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("flags public secret names while allowing public URLs and server-only secrets", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "semgrep-public-secrets-"));
  const fixture = path.join(directory, "example.ts");
  writeFileSync(
    fixture,
    [
      "export const leaked = process.env.NEXT_PUBLIC_API_KEY;",
      "export const publicUrl = process.env.NEXT_PUBLIC_API_URL;",
      "export const serverSecret = process.env.SERVICE_SECRET;",
    ].join("\n"),
  );
  try {
    const result = spawnSync(
      "semgrep",
      ["scan", "--config", ".semgrep.yml", "--json", "--metrics=off", fixture],
      {
        encoding: "utf8",
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as {
      results: Array<{ check_id: string; start: { line: number } }>;
      errors: unknown[];
    };
    expect(report.errors).toEqual([]);
    expect(report.results.map((finding) => finding.check_id)).toEqual([
      "next-public-env-secret",
    ]);
    expect(report.results[0].start.line).toBe(1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 60_000);
