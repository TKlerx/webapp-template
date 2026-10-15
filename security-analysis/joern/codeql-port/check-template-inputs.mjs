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
assert.equal(controls.querySha256, queryHash, 'Controls must cover the current query');
for (const entry of manifest.files) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(runRoot, 'source', entry.path))).digest('hex'), entry.sha256);
}
const summary = { capturedAt: manifest.capturedAt, commit: manifest.commit, querySha256: queryHash, scope: manifest.scope, controls: controls.controls, application: {}, limits: [
  'No findings does not prove absence of vulnerabilities; source models and Joern data flow are bounded.',
  'Request aliases, reassigned helper results, arbitrary validation/serializer propagation and shell-interpreted argument lists are not exhaustively modeled.',
  'Worker sources cover BackgroundJob-typed parameters and payload reads of jobs claimed on typed JobStore parameters or locals constructed from the db.JobStore class.',
  'Unknown or dynamically resolved process APIs, other command libraries, Go/PowerShell/shell code and dependencies remain outside the query.',
  'Default Joern frontend omissions are listed per language; snapshot files remain available for inspection.'
] };
for (const language of ['javascript', 'python']) {
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
  summary.application[language] = { expectedFiles: expected.length, representedFiles: actual.length, missingFiles, modeledSources: current.sources.length, sourceModels: modelCounts, processCalls: current.processCalls.length, findings: current.findings };
}
fs.writeFileSync(path.join(runRoot, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary.application, null, 2));
assert(Object.values(summary.application).every(result => result.findings.length === 0), 'Command-injection findings require review; see summary.json');
