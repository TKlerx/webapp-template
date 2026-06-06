import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const varFile = process.argv[2] ?? "environments/dev.tfvars";
const tempDir = mkdtempSync(join(tmpdir(), "webapp-template-infra-plan-"));
const workDir = join(tempDir, "azure");
const planPath = join(tempDir, "tfplan");
const tofuEnv = {
  ...process.env,
  TF_DATA_DIR: join(tempDir, ".terraform"),
};

const requiredTypes = new Set([
  "azurerm_application_insights",
  "azurerm_container_app",
  "azurerm_container_app_environment",
  "azurerm_container_app_job",
  "azurerm_key_vault",
  "azurerm_log_analytics_workspace",
  "azurerm_postgresql_flexible_server",
  "azurerm_postgresql_flexible_server_database",
  "azurerm_private_endpoint",
  "azurerm_role_assignment",
]);

try {
  cpSync("infra/azure", workDir, { recursive: true });
  const backendPath = join(workDir, "backend.tf");
  if (existsSync(backendPath)) {
    rmSync(backendPath);
  }

  runTofu([
    `-chdir=${workDir}`,
    "init",
    "-backend=false",
    "-input=false",
    "-reconfigure",
  ]);
  runTofu([
    `-chdir=${workDir}`,
    "plan",
    "-refresh=false",
    "-input=false",
    `-var-file=${varFile}`,
    `-out=${planPath}`,
  ]);

  const plan = runTofuJson([`-chdir=${workDir}`, "show", "-json", planPath]);
  const plannedTypes = new Set(
    (plan.resource_changes ?? [])
      .filter(
        (change) => !["no-op", "delete"].includes(change.change?.actions?.[0]),
      )
      .map((change) => change.type),
  );

  const missing = [...requiredTypes].filter((type) => !plannedTypes.has(type));
  const containerApps = (plan.resource_changes ?? []).filter(
    (change) => change.type === "azurerm_container_app",
  );
  const missingNamedApps =
    !containerApps.some((change) => change.name === "app") ||
    !containerApps.some((change) => change.name === "worker");

  if (missing.length > 0 || missingNamedApps) {
    if (missing.length > 0) {
      console.error(`Missing required resource types: ${missing.join(", ")}`);
    }
    if (missingNamedApps) {
      console.error("Plan must include app and worker Container Apps.");
    }
    process.exit(1);
  }

  console.log("Infrastructure plan coverage check passed.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function runTofu(args) {
  const result = spawnSync("tofu", args, {
    encoding: "utf8",
    env: tofuEnv,
    stdio: "inherit",
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runTofuJson(args) {
  const result = spawnSync("tofu", args, { encoding: "utf8", env: tofuEnv });
  if ((result.status ?? 1) !== 0) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    process.exit(result.status ?? 1);
  }
  return JSON.parse(result.stdout);
}
