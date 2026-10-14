import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("analysis gates", () => {
  it.each(["vulnerabilities", "unavailable"])(
    "blocks production audit failures without an opt-in flag: %s",
    (mode) => {
      const result = spawnSync(
        "pwsh",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `
      $tokens = $null; $errors = $null
      $ast = [System.Management.Automation.Language.Parser]::ParseFile('${path.join(root, "validate.ps1").replaceAll("'", "''")}', [ref]$tokens, [ref]$errors)
      if ($errors.Count) { throw $errors[0] }
      $function = $ast.EndBlock.Statements | Where-Object { $_ -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Test-ProductionDependencyAudit' }
      Invoke-Expression $function.Extent.Text
      $failures = @()
      function Write-Step {}; function Write-Pass {}; function Write-Fail {}; function Write-Warn {}
      function Get-AuditPackageStatuses { @() }
      function Invoke-NativeCommandCaptured {
        if ('${mode}' -eq 'unavailable') { throw 'audit tool unavailable' }
        @{ ExitCode = 1; Output = @('{"metadata":{"vulnerabilities":{"total":1,"high":1,"moderate":0,"low":0,"critical":0}},"vulnerabilities":{"next":{}}}') }
      }
      Test-ProductionDependencyAudit
      if ($failures -notcontains 'prod-audit') { throw 'Audit failure was advisory' }
    `,
        ],
        { cwd: root, encoding: "utf8" },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stdout + result.stderr).toBe(0);
    },
    15_000,
  );

  it("rejects unsafe values, floating and misplaced promises, and body parser bypasses", async () => {
    const eslint = new ESLint({ cwd: root });
    const [result] = await eslint.lintText(
      `
      export async function example(request: Request, unsafe: any) {
        Promise.resolve();
        [1].forEach(async () => {});
        const value = unsafe.value;
        await request.json();
        await request["formData"]();
        return value;
      }
    `,
      { filePath: "src/app/api/health/route.ts" },
    );
    const rules = result.messages.map((message) => message.ruleId);
    expect(
      rules.filter((rule) => rule === "no-restricted-syntax"),
    ).toHaveLength(2);
    expect(rules).toEqual(
      expect.arrayContaining([
        "@typescript-eslint/no-floating-promises",
        "@typescript-eslint/no-misused-promises",
        "@typescript-eslint/no-unsafe-assignment",
        "@typescript-eslint/no-unsafe-member-access",
        "@typescript-eslint/no-unsafe-return",
        "no-restricted-syntax",
      ]),
    );
    const [valid] = await eslint.lintText(
      `
      import { parseJsonBody } from "@/lib/validation";
      import { z } from "zod";
      export async function example(request: Request) {
        return await parseJsonBody(request, z.object({ name: z.string() }).strict());
      }
    `,
      { filePath: "src/app/api/health/route.ts" },
    );
    expect(valid.errorCount).toBe(0);
  }, 120_000);

  it("blocks cycles and forbidden layer imports while allowing type-only imports", () => {
    const fixture = fs.mkdtempSync(
      path.join(os.tmpdir(), "analysis-architecture-"),
    );
    try {
      fs.copyFileSync(
        path.join(root, ".dependency-cruiser.cjs"),
        path.join(fixture, ".dependency-cruiser.cjs"),
      );
      const files = {
        "src/services/example.ts":
          'import "../components/example"; import "./cycle";',
        "src/services/cycle.ts": 'import "./example";',
        "src/components/example.ts":
          'import "../services/example"; import "../lib/db";',
        "src/components/client.ts": 'import "../../generated/prisma/client";',
        "generated/prisma/client.ts": "export const client = {};",
        "src/lib/db.ts": "export const db = {};",
        "src/components/types.ts":
          'import type { Model } from "../services/types"; export type Row = Model;',
        "src/services/types.ts": "export type Model = { id: string };",
        "tsconfig.json":
          '{"compilerOptions":{"module":"esnext","target":"ES2022"}}',
      };
      for (const [file, content] of Object.entries(files)) {
        const target = path.join(fixture, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
      }
      const result = spawnSync(
        process.execPath,
        [
          path.join(
            root,
            "node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
          ),
          "--config",
          ".dependency-cruiser.cjs",
          "src",
          "--output-type",
          "json",
        ],
        { cwd: fixture, encoding: "utf8" },
      );
      expect(result.error).toBeUndefined();
      expect(result.stdout, result.stderr).not.toBe("");
      const report = JSON.parse(result.stdout) as {
        summary: {
          violations: Array<{
            from: string;
            rule: { name: string; severity: string };
          }>;
        };
      };
      expect(result.status).toBe(0); // The JSON reporter only serializes findings.
      expect(
        report.summary.violations.map((violation) => violation.rule.name),
      ).toEqual(
        expect.arrayContaining([
          "no-circular",
          "no-server-to-ui",
          "no-components-to-services",
          "no-ui-to-database",
        ]),
      );
      expect(
        report.summary.violations.every(
          (violation) => violation.rule.severity === "error",
        ),
      ).toBe(true);
      expect(
        report.summary.violations.some((violation) =>
          violation.from.endsWith("types.ts"),
        ),
      ).toBe(false);
      expect(
        report.summary.violations.some(
          (violation) =>
            violation.from === "src/components/client.ts" &&
            violation.rule.name === "no-ui-to-database",
        ),
      ).toBe(true);
      const gate = spawnSync(
        process.execPath,
        [
          path.join(
            root,
            "node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
          ),
          "--config",
          ".dependency-cruiser.cjs",
          "src",
        ],
        { cwd: fixture, encoding: "utf8" },
      );
      expect(gate.error).toBeUndefined();
      expect(gate.status, gate.stdout + gate.stderr).toBeGreaterThan(0);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  }, 30_000);

  it.each([
    ["Typecheck - Python (mypy)", "all", "mypy"],
    ["Tests - Python (pytest)", "test", "pytest"],
    ["Format check (prettier)", "quality", "prettier"],
    ["E2E Tests (playwright)", "full", "e2e"],
  ])(
    "fails when a required check is unavailable: %s",
    (label, phase, failure) => {
      // Execute the actual phase block with missing-tool responses, without running unrelated checks.
      const result = spawnSync(
        "pwsh",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `
      $tokens = $null; $errors = $null
      $ast = [System.Management.Automation.Language.Parser]::ParseFile('${path.join(root, "validate.ps1").replaceAll("'", "''")}', [ref]$tokens, [ref]$errors)
      if ($errors.Count) { throw $errors[0] }
      $block = $ast.EndBlock.Statements | Where-Object { $_ -is [System.Management.Automation.Language.IfStatementAst] -and $_.Extent.Text.Contains('Write-Step "${label}"') }
      if (@($block).Count -ne 1) { throw 'Expected one validation block' }
      $Phase = '${phase}'; $failures = @()
      function Write-Step {} ; function Write-Pass {}; function Write-Fail {}; function Write-Warn {}
      function Invoke-NativeCommandCaptured { @{ ExitCode = 127; Output = @() } }
      function Test-Path { $false }
      function Test-HasPlaywrightSpecs { $false }
      Invoke-Expression $block.Extent.Text
      if ($failures -notcontains '${failure}') { throw 'Required check was skipped' }
    `,
        ],
        { cwd: root, encoding: "utf8" },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stdout + result.stderr).toBe(0);
    },
    15_000,
  );
});
