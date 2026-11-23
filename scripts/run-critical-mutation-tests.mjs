import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const testFiles = ["tests/unit/cli-release-service.test.ts"];

const mutants = [
  {
    name: "CLI release lookup accepts wrong artifact prefix",
    file: "src/services/api/cli-release-service.ts",
    from: 'entry.name.startsWith("starterctl_")',
    to: 'entry.name.startsWith("projectboard_")',
  },
  {
    name: "CLI release lookup selects oldest matching artifact",
    file: "src/services/api/cli-release-service.ts",
    from: ".sort()\n      .at(-1)",
    to: ".sort()\n      .at(0)",
  },
  {
    name: "Linux x64 archive extension changes to zip",
    file: "src/services/api/cli-release-service.ts",
    from: 'target: "linux-amd64",\n    label: "Linux x64",\n    goos: "linux",\n    arch: "amd64",\n    extension: "tar.gz",',
    to: 'target: "linux-amd64",\n    label: "Linux x64",\n    goos: "linux",\n    arch: "amd64",\n    extension: "zip",',
  },
];

const pnpmCli = process.env.npm_execpath;

if (!pnpmCli) {
  throw new Error("pnpm CLI path is unavailable.");
}

function runVitest(args = [], quiet = false) {
  const result = spawnSync(
    process.execPath,
    [pnpmCli, "exec", "vitest", "run", ...testFiles, ...args],
    { encoding: "utf8", stdio: quiet ? "pipe" : "inherit" },
  );
  if (result.error) throw result.error;
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function verifyTestFailure(status, reportFile, output, name) {
  let report;
  try {
    report = JSON.parse(readFileSync(reportFile, "utf8"));
  } catch {
    throw new Error(
      `Mutation run did not write a test report for ${name}.\n${output}`,
    );
  }
  const failed = report.testResults.flatMap(({ assertionResults }) =>
    assertionResults.filter(({ status }) => status === "failed"),
  );
  if (
    status !== 1 ||
    report.testResults.length !== 1 ||
    failed.length === 0 ||
    !failed.every(({ failureMessages }) =>
      failureMessages.some((message) =>
        /AssertionError|at Assertion\./.test(message),
      ),
    )
  ) {
    throw new Error(
      `Mutation run did not fail through a test assertion for ${name}.\n${output}`,
    );
  }
}

function replaceOnce(source, from, to, name) {
  const first = source.indexOf(from);
  if (first === -1 || source.indexOf(from, first + from.length) !== -1) {
    throw new Error(`Mutant "${name}" expected exactly one match.`);
  }
  return source.slice(0, first) + to + source.slice(first + from.length);
}

console.log("Baseline critical tests");
if (runVitest().status !== 0) {
  process.exit(1);
}

const survivors = [];

const temp = mkdtempSync(path.join(tmpdir(), "critical-mutation-"));
const configFile = path.join(temp, "vitest.config.mjs");
const mutatedFile = path.join(temp, "cli-release-service.ts");
const report = path.join(temp, "report.json");
try {
  writeFileSync(
    configFile,
    `export default ${JSON.stringify({
      root: process.cwd(),
      test: { include: testFiles },
      resolve: { alias: { "@/services/api/cli-release-service": mutatedFile } },
    })};\n`,
  );
  for (const mutant of mutants) {
    const original = readFileSync(mutant.file, "utf8");
    writeFileSync(
      mutatedFile,
      replaceOnce(original, mutant.from, mutant.to, mutant.name),
    );
    rmSync(report, { force: true });
    console.log(`\nMutant: ${mutant.name}`);
    const { status, output } = runVitest(
      ["--config", configFile, "--reporter=json", "--outputFile", report],
      true,
    );
    if (status === 0) {
      survivors.push(mutant.name);
      console.error(`Survived: ${mutant.name}`);
    } else {
      verifyTestFailure(status, report, output, mutant.name);
      console.log(`Killed: ${mutant.name}`);
    }
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

if (survivors.length > 0) {
  console.error(
    `\nMutation survivors:\n${survivors.map((name) => `- ${name}`).join("\n")}`,
  );
  process.exit(1);
}

console.log("\nAll critical mutants killed.");
