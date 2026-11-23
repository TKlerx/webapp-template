import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const consoleCalls = new Set(["log", "info", "warn", "error", "debug"]);
const pythonScanner = `
import ast, json, pathlib, sys

findings = []
for filename in json.load(sys.stdin):
    source = pathlib.Path(filename).read_text(encoding="utf-8")
    for node in ast.walk(ast.parse(source, filename=filename)):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if isinstance(func, ast.Name) and func.id == "print":
            findings.append([filename, node.lineno, "print"])
        elif (isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name)
              and func.value.id == "logger" and func.attr in ("info", "warning", "error", "exception")):
            findings.append([filename, node.lineno, "logger"])
print(json.dumps(findings))
`;

const PRODUCTION_PATHS = [
  "src/app",
  "src/lib",
  "src/services",
  "src/proxy.ts",
  "src/instrumentation.ts",
  "worker/src/starter_worker",
];
const EXCLUDED_PATHS = new Set([
  normalizePath("src/lib/logger.ts"),
  normalizePath("worker/src/starter_worker/logging.py"),
]);

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function isSourceFile(filePath) {
  return /\.(ts|tsx|py)$/.test(filePath);
}

function walk(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  const stats = fs.statSync(absolutePath);
  if (stats.isFile()) {
    return isSourceFile(relativePath) ? [normalizePath(relativePath)] : [];
  }

  const files = [];
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    if (entry.name === "__pycache__" || entry.name === "node_modules") {
      continue;
    }
    const child = normalizePath(path.join(relativePath, entry.name));
    files.push(...walk(root, child));
  }
  return files;
}

function scanAppFile(root, filePath) {
  const source = ts.createSourceFile(
    filePath,
    fs.readFileSync(path.join(root, filePath), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const findings = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const access =
        ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee);
      if (
        access &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "console"
      ) {
        const method = ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : ts.isStringLiteral(callee.argumentExpression)
            ? callee.argumentExpression.text
            : undefined;
        if (method && consoleCalls.has(method)) {
          findings.push({
            path: filePath,
            line:
              source.getLineAndCharacterOfPosition(node.getStart(source)).line +
              1,
            pattern: `console.${method}`,
            remediation: "Use the structured logger from src/lib/logger.ts.",
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

function scanPythonFiles(root, files) {
  if (files.length === 0) return [];
  const options = { cwd: root, encoding: "utf8", input: JSON.stringify(files) };
  const args = ["-c", pythonScanner];
  let result = spawnSync("python3", args, options);
  if (result.error?.code === "ENOENT")
    result = spawnSync("python", args, options);
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(result.stderr || "Worker source parsing failed.");
  return JSON.parse(result.stdout).map(([file, line, pattern]) => ({
    path: file,
    line,
    pattern,
    remediation:
      "Use the worker structured logger from starter_worker.logging.",
  }));
}

export function scanLoggingGuard(options = {}) {
  const root = options.root ? path.resolve(options.root) : process.cwd();
  const candidates =
    options.files?.map(normalizePath) ??
    PRODUCTION_PATHS.flatMap((productionPath) => walk(root, productionPath));
  const files = candidates.filter(
    (file) =>
      !EXCLUDED_PATHS.has(file) &&
      isSourceFile(file) &&
      fs.existsSync(path.join(root, file)),
  );
  const app = files.filter((file) => !file.endsWith(".py"));
  const worker = files.filter((file) => file.endsWith(".py"));
  return [
    ...app.flatMap((file) => scanAppFile(root, file)),
    ...scanPythonFiles(root, worker),
  ];
}

function main() {
  const rootArgIndex = process.argv.indexOf("--root");
  const root =
    rootArgIndex >= 0 && process.argv[rootArgIndex + 1]
      ? process.argv[rootArgIndex + 1]
      : process.cwd();
  const findings = scanLoggingGuard({ root });

  if (findings.length === 0) {
    console.log("Logging guard passed.");
    return;
  }

  console.error("Logging guard found ad hoc production logging:");
  for (const finding of findings) {
    console.error(`${finding.path}:${finding.line} ${finding.remediation}`);
  }
  process.exitCode = 1;
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  main();
}
