import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("overview check ignores its date but detects changed content", () => {
  const root = mkdtempSync(path.join(tmpdir(), "spec-overview-"));
  const script = fileURLToPath(
    new URL("./update-spec-overview.mjs", import.meta.url),
  );
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: "utf8",
    });
  try {
    mkdirSync(path.join(root, "specs"));
    assert.equal(run().status, 0);
    const overview = path.join(root, "specs", "OVERVIEW.md");
    const oldDate = readFileSync(overview, "utf8").replace(
      /^Last Updated: .+$/m,
      "Last Updated: 2000-01-01",
    );
    writeFileSync(overview, oldDate);
    assert.equal(run("--check").status, 0);
    assert.equal(readFileSync(overview, "utf8"), oldDate);
    writeFileSync(overview, oldDate.replace("Purpose:", "Incorrect purpose:"));
    assert.equal(run("--check").status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
