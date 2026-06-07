import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_PATH = path.resolve(
  process.cwd(),
  ".github/workflows/deploy-azure.yml",
);

function stepIndex(workflow: string, stepId: string) {
  const index = workflow.indexOf(`id: ${stepId}`);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe("Azure deploy workflow contract", () => {
  it("uses OIDC and pinned actions without long-lived Azure credentials", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain(
      "actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd",
    );
    expect(workflow).toContain(
      "opentofu/setup-opentofu@9d84900f3238fab8cd84ce47d658d25dd008be2f",
    );
    expect(workflow).toContain(
      "Azure/login@1384c340ab2dda50fed2bee3041d1d87018aa5e8",
    );
    expect(workflow).not.toContain("AZURE_CLIENT_SECRET");
    expect(workflow).not.toContain("client-secret");
  });

  it("declares required deploy inputs", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain("environment:");
    expect(workflow).toContain("app_image_tag:");
    expect(workflow).toContain("worker_image_tag:");
    expect(workflow).toContain("migration_image_tag:");
    expect(workflow).toContain("options:");
    expect(workflow).toContain("- dev");
    expect(workflow).toContain("- staging");
    expect(workflow).toContain("- prod");
  });

  it("validates images before provisioning and migrates before promotion", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");

    const validate = stepIndex(workflow, "validate-inputs");
    const provision = stepIndex(workflow, "provision");
    const migrate = stepIndex(workflow, "migrate");
    const promote = stepIndex(workflow, "promote-app-worker");
    const report = stepIndex(workflow, "report");

    expect(validate).toBeLessThan(provision);
    expect(provision).toBeLessThan(migrate);
    expect(migrate).toBeLessThan(promote);
    expect(promote).toBeLessThan(report);
    expect(workflow).toContain("az acr repository show-tags");
    expect(workflow).toContain("az containerapp job start");
  });

  it("blocks promotion when migration fails and reports non-promotion", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain("if: ${{ steps.migrate.outcome == 'success' }}");
    expect(workflow).toContain("Migration job failed");
    expect(workflow).toContain("Migration job timed out");
    expect(workflow).toContain("if: ${{ always() }}");
    expect(workflow).toContain("not-promoted");
  });
});
