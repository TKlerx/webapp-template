import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const lines = name => fs.readFileSync(path.join(root, name), 'utf8').split(/\r?\n/);
const summary = { querySha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'command-injection.sc'))).digest('hex'), controls: {} };
for (const [language, filename, unsafeNames, safeNames, lookalike, sinkLine] of [
  ['javascript', 'input-controls/typescript/routes.ts', ['unsafeJson', 'unsafeForm', 'unsafeQuery', 'unsafeHeader', 'unsafeCookie', 'unsafeUrl', 'unsafeJsonHelper', 'unsafeFormHelper', 'unsafeParams'], ['safeJson', 'safeForm', 'safeQuery', 'safeHeader', 'safeCookie', 'safeUrl', 'safeJsonHelper', 'safeFormHelper', 'safeParams'], 'unrelatedReader', 3],
  ['python', 'input-controls/python/jobs.py', ['unsafe_payload', 'unsafe_claimed', 'unsafe_constructed'], ['safe_payload', 'safe_claimed', 'safe_constructed'], 'unrelated_payload', 5]
]) {
  const result = read(`${language}-input-controls.json`);
  const sourceLines = lines(filename);
  function bodyLine(name) {
    const index = sourceLines.findIndex(line => new RegExp(`(?:function|def) ${name}\\(`).test(line));
    assert(index >= 0, `Missing fixture ${name}`);
    return index + (language === 'python' ? (name.includes('constructed') ? 4 : name.includes('claimed') ? 3 : 2) : 1);
  }
  const fixtureFile = language === 'python' ? 'jobs.py' : 'routes.ts';
  const containsLine = (finding, line) => finding.path.some(node => node.file === fixtureFile && node.line === line);
  for (const name of unsafeNames) assert(result.findings.some(finding => containsLine(finding, bodyLine(name))), `Must detect ${name}`);
  const lookalikes = language === 'python' ? [lookalike, 'unrelated_claimed'] : [lookalike];
  for (const name of [...safeNames, ...lookalikes]) {
    const line = bodyLine(name);
    assert(!result.findings.some(finding => containsLine(finding, line)), `Must not flag ${name}`);
    if (lookalikes.includes(name)) assert(!result.sources.some(source => source.file === fixtureFile && source.line === line), 'Unrelated object must not be a modeled boundary');
    else assert(result.sources.some(source => source.file === fixtureFile && source.line === line), `Safe input ${name} must still be modeled`);
  }
  assert.equal(result.processCalls.length, 2, 'Both imported process helpers must be represented');
  for (const finding of result.findings) {
    assert.equal(finding.sink.line, sinkLine);
    assert.equal(new Set(finding.path.map(node => node.file)).size >= 2, true, 'Must trace into imported helper');
    assert(finding.sourceModel.startsWith(language === 'python' ? 'worker.' : 'nextjs.'));
  }
  summary.controls[language] = { unsafeCasesDetected: unsafeNames.length, safeCasesUnflagged: safeNames.length, unrelatedObjectsUnflagged: lookalikes.length, alerts: result.findings.length, models: [...new Set(result.sources.map(source => source.model))] };
}
fs.writeFileSync(path.join(root, 'input-model-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
