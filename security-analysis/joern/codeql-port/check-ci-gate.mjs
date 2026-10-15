// Exercise the real report checker: blocking findings and engine failures must
// fail CI, while reviewed advisory families stay visible without failing it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const destination = fs.mkdtempSync(path.join(root, 'application-gate-'));
const write = (name, value) => fs.writeFileSync(path.join(destination, name), typeof value === 'string' ? value : JSON.stringify(value));
const source = 'fixture\n';
const sha256 = crypto.createHash('sha256').update(source).digest('hex');
const files = ['app.ts', 'worker.py'];
fs.mkdirSync(path.join(destination, 'source'));
for (const file of files) write(`source/${file}`, source);
write('manifest.json', { capturedAt: 'test', commit: 'test', scope: ['gate controls'], files: files.map(name => ({ path: name, sha256 })) });
const result = language => ({
  calls: 1, methods: 1, files: [language === 'python' ? 'worker.py' : 'app.ts'],
  sources: (language === 'python' ? ['worker.job-payload'] : ['nextjs.reader', 'nextjs.validated-body-helper']).map(model => ({ model })),
  processCalls: [], findings: [],
});
for (const language of ['javascript', 'python']) {
  write(`${language}-results.json`, result(language));
  write(`${language}-query.log`, '');
}
function check(expectedExit, reason) {
  const execution = spawnSync(process.execPath, [path.join(root, 'check-template-inputs.mjs'), path.basename(destination)], {
    encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '' },
  });
  assert.equal(execution.status, expectedExit, `${reason}\n${execution.stdout}\n${execution.stderr}`);
}
try {
  check(0, 'A complete clean analysis must pass');
  for (const ruleId of ['js/sql-injection', 'js/unrecognized-rule', 'js/open-redirect', 'js/sensitive-logging']) {
    write('javascript-results.json', { ...result('javascript'), findings: [{ ruleId }] });
    const advisory = ruleId === 'js/open-redirect' || ruleId === 'js/sensitive-logging';
    check(advisory ? 0 : 1, `Gate policy for ${ruleId}`);
    const summary = JSON.parse(fs.readFileSync(path.join(destination, 'summary.json'), 'utf8'));
    assert.equal(summary.application.javascript.findings[0].ruleId, ruleId, 'All findings must remain in the evidence');
  }
  write('javascript-results.json', result('javascript'));
  write('javascript-query.log', 'SolveTask failed with exception');
  check(1, 'A partial engine failure must never look like a clean scan');
  write('javascript-query.log', '');
  write('source/app.ts', 'changed after capture');
  check(1, 'Changed snapshot content must invalidate the analysis');
  console.log('PASS: CI gate blocks SQL/unknown rules, preserves advisory findings, and rejects engine failures and changed source.');
} finally {
  assert.equal(path.dirname(destination), root);
  assert(path.basename(destination).startsWith('application-gate-'));
  fs.rmSync(destination, { recursive: true, force: true });
}
