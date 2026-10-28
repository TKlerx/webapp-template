import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = import.meta.dirname;
const summary = {
  tool: "CodeQL 2.27.2",
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: path.resolve(root, "../.."), encoding: "utf8" }).trim(),
  workingTreeDirty: Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: path.resolve(root, "../.."), encoding: "utf8" }).trim()),
  sourcePaths: ["src", "worker/src"],
  suite: "security-extended",
  scans: [],
  controls: [],
  limitations: [
    "Zero findings is not proof of correctness or security.",
    "The control uses Express and Flask; it does not establish completeness for Next.js, Prisma, Zod, or Pydantic.",
    "Dependency vulnerabilities are checked separately by the existing dependency audits.",
    "CodeQL's free license does not cover arbitrary closed-source projects.",
  ],
};

for (const [language, sinkLine, ruleId] of [
  ["javascript", 4, "js/command-line-injection"],
  ["python", 5, "py/command-line-injection"],
]) {
  const scan = JSON.parse(readFileSync(path.join(root, `${language}.sarif`), "utf8")).runs[0];
  assert(scan.invocations.every((invocation) => invocation.executionSuccessful));
  const warnings = scan.invocations.flatMap((invocation) => invocation.toolExecutionNotifications ?? [])
    .filter((notification) => ["warning", "error"].includes(notification.level));
  const log = readFileSync(path.join(root, `${language}-analysis.log`), "utf8");
  const coverage = log.match(/CodeQL scanned (\d+) out of (\d+)/);
  assert(coverage, "Missing extraction coverage");
  assert.equal(coverage[1], coverage[2], "Incomplete extraction coverage");
  summary.scans.push({ language, filesScanned: Number(coverage[1]), rules: scan.tool.driver.rules.length,
    findings: scan.results.length, warnings: warnings.length, report: `${language}.sarif` });

  const control = JSON.parse(readFileSync(path.join(root, `control-${language}.sarif`), "utf8")).runs[0];
  assert(control.invocations.every((invocation) => invocation.executionSuccessful));
  const findings = control.results.filter((result) => result.ruleId === ruleId);
  assert.equal(findings.length, 1, "Expected only the unsafe command-injection control");
  assert.equal(findings[0].locations[0].physicalLocation.region.startLine, sinkLine);
  const flowFiles = new Set(findings[0].codeFlows.flatMap((flow) => flow.threadFlows)
    .flatMap((flow) => flow.locations).map((location) => location.location.physicalLocation.artifactLocation.uri));
  assert.equal(flowFiles.size, 2, "Expected a trace across the route and wrapper files");
  summary.controls.push({ language, ruleId, unsafeDetected: true, safeCommandInjectionFindings: 0,
    tracedFiles: [...flowFiles], report: `control-${language}.sarif` });
}

writeFileSync(path.join(root, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
