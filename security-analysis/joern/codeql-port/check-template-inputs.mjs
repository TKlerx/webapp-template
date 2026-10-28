import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const runRoot = path.join(root, process.argv[2] ?? 'application-input-models');
const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const manifest = read(path.join(runRoot, 'manifest.json'));
const controls = read(path.join(root, 'input-model-summary.json'));
const queryHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'command-injection.sc'))).digest('hex');
// ponytail: guard/redactor precision needs more controls before these families block application CI.
// Controls still require their unsafe detections and reject safe-case regressions.
const advisoryRules = new Set(['js/open-redirect', 'py/open-redirect', 'js/sensitive-logging', 'py/sensitive-logging']);
// Joern 4.0.650 frontend omissions reviewed in the baseline run. New omissions fail.
const allowedMissingJavaScriptFiles = new Set([
  '.dependency-cruiser.cjs',
  'next-env.d.ts',
  'scripts/update-spec-overview.test.mjs',
  'src/app/(dashboard)/docs/api/page.tsx',
  'src/components/docs/swagger-ui.tsx',
  'src/i18n/config.ts',
  'src/i18n/locale.ts',
  'src/i18n/request.ts',
  'src/lib/__mocks__/db.ts',
]);
assert.equal(controls.querySha256, queryHash, 'Controls must cover the current query');
for (const entry of manifest.files) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(runRoot, 'source', entry.path))).digest('hex'), entry.sha256);
}
const summary = { capturedAt: manifest.capturedAt, commit: manifest.commit, querySha256: queryHash, scope: manifest.scope, advisoryRules: [...advisoryRules], controls: controls.controls, application: {}, limits: [
  'No findings does not prove absence of vulnerabilities; source models and Joern data flow are bounded.',
  'Request aliases, reassigned helper results, arbitrary validation/serializer propagation and shell-interpreted argument lists are not exhaustively modeled.',
  'Worker sources cover BackgroundJob-typed parameters and payload reads of jobs claimed on typed JobStore parameters or locals constructed from the db.JobStore class.',
  'Unknown or dynamically resolved process APIs, other command libraries, Go/PowerShell/shell code and dependencies remain outside the query.',
  'Network/database/file/redirect APIs use bounded import/type models; namespace-helper propagation and control-flow allowlist/containment checks are not comprehensively modeled.',
  'Sensitive logging models named credential values reaching direct console/standard logging calls; custom redaction wrappers and persisted-secret safety require separate regression coverage.',
  'Default Joern frontend omissions are listed per language; snapshot files remain available for inspection.'
] };
for (const language of ['javascript', 'python']) {
  const queryLog = fs.readFileSync(path.join(runRoot, `${language}-query.log`), 'utf8');
  assert(!/SolveTask failed with exception|OutOfMemoryError|StackOverflowError/.test(queryLog), `${language} data-flow engine failed; see query log`);
  const current = read(path.join(runRoot, `${language}-results.json`));
  assert(current.calls > 0 && current.methods > 0);
  const modelCounts = {};
  for (const source of current.sources) modelCounts[source.model] = (modelCounts[source.model] ?? 0) + 1;
  assert(language === 'python' ? modelCounts['worker.job-payload'] > 0 : modelCounts['nextjs.reader'] > 0 && modelCounts['nextjs.validated-body-helper'] > 0, 'Actual template boundaries must be recognized');
  const expected = manifest.files.map(entry => entry.path).filter(name => language === 'python' ? /\.py$/.test(name) : /\.(?:tsx?|jsx?|mjs|cjs)$/.test(name));
  const actual = current.files.filter(name => name !== 'N/A').map(name => name.replaceAll('\\', '/'));
  assert(actual.every(name => expected.includes(name)));
  const missingFiles = expected.filter(name => !actual.includes(name));
  if (language === 'python') assert.equal(missingFiles.length, 0);
  else assert.deepEqual(missingFiles.filter(name => !allowedMissingJavaScriptFiles.has(name)), [], 'Unexpected JavaScript/TypeScript extraction omissions require review');
  const sinkCounts = {};
  for (const sink of current.securitySinks ?? []) sinkCounts[sink.rule] = (sinkCounts[sink.rule] ?? 0) + 1;
  const blockingFindings = current.findings.filter(finding => !advisoryRules.has(finding.ruleId));
  const advisoryFindings = current.findings.filter(finding => advisoryRules.has(finding.ruleId));
  summary.application[language] = { expectedFiles: expected.length, representedFiles: actual.length, missingFiles, modeledSources: current.sources.length, sourceModels: modelCounts, processCalls: current.processCalls.length, securitySinks: sinkCounts, secretSources: current.secretSources?.length ?? 0, findings: current.findings, blockingFindings, advisoryFindings };
}
fs.writeFileSync(path.join(runRoot, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
const counts = Object.fromEntries(Object.entries(summary.application).map(([language, result]) => [language, {
  representedFiles: result.representedFiles, expectedFiles: result.expectedFiles, missingFiles: result.missingFiles,
  sourceModels: result.sourceModels, securitySinks: result.securitySinks,
  blockingFindings: result.blockingFindings.length, advisoryFindings: result.advisoryFindings.length,
}]));
console.log(JSON.stringify(counts, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = Object.entries(counts).map(([language, result]) =>
    `| ${language} | ${result.representedFiles}/${result.expectedFiles} | ${result.blockingFindings} | ${result.advisoryFindings} |`);
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\n### Joern security analysis\n\n| Language | Files represented | Blocking findings | Advisory findings |\n| --- | --- | --- | --- |\n' + rows.join('\n') + '\n\nRedirect/logging findings are advisory during model calibration. Full traces, sink counts and omitted files are in the joern-analysis artifact.\n');
}
assert(Object.values(summary.application).every(result => result.blockingFindings.length === 0), 'Blocking security findings require review; see summary.json');
