import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_PATH = path.resolve(
  process.cwd(),
  ".github/workflows/validate.yml",
);

describe("validate workflow fixtures", () => {
  it("pins actions to immutable commit SHAs", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain(
      "actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd",
    );
    expect(workflow).toContain(
      "actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444",
    );
    expect(workflow).toContain(
      "actions/setup-python@a309ff8b426b58ec0e2a45f0f869d46889d02405",
    );
    expect(workflow).toContain(
      "astral-sh/setup-uv@08807647e7069bb48b6ef5acd8ec9567f424441b",
    );
  });

  it("does not install uv via remote shell script", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).not.toContain("astral.sh/uv/install.sh");
    expect(workflow).not.toContain("curl -LsSf");
  });

  it("reports broad dependency audits before gating on production audits", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
    const steps = workflow.split(/^ {6}- name: /m);
    const blocking = [
      "pnpm audit --prod --audit-level low",
      "uv audit --frozen --no-dev",
      "go run golang.org/x/vuln/cmd/govulncheck@v1.8.0 -scan=package -test=false .",
    ];
    const advisory = [
      "pnpm audit --audit-level low",
      "uv audit --frozen",
      "go run golang.org/x/vuln/cmd/govulncheck@v1.8.0 -scan=module",
    ];
    const stepIndex = (command: string) =>
      steps.findIndex((step) =>
        step.split(/\r?\n/).includes(`        run: ${command}`),
      );

    for (const command of advisory) {
      const index = stepIndex(command);
      expect(index).toBeGreaterThan(0);
      expect(steps[index]).toContain("continue-on-error: true");
      for (const productionCommand of blocking) {
        expect(index).toBeLessThan(stepIndex(productionCommand));
      }
    }
    for (const command of blocking) {
      expect(steps[stepIndex(command)]).not.toMatch(/continue-on-error:/);
    }
  });

  it("uses the same mandatory validation entry points locally and in CI", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.validate).toBe(
      "pwsh -NoProfile -ExecutionPolicy Bypass -File validate.ps1 all",
    );
    expect(pkg.scripts["validate:full"]).toBe(
      "pwsh -NoProfile -ExecutionPolicy Bypass -File validate.ps1 full",
    );
    expect(workflow).toContain("run: pnpm run validate:full");
    expect(workflow).toContain("uv sync --all-groups --locked");
  });
});
