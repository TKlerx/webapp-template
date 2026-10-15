import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const summary = {
  joernVersion: '4.0.650',
  provenance: { cliBundle: 'CodeQL 2.27.2', javascriptQueries: '2.4.7', javascriptLibrary: '2.10.3', pythonQueries: '1.8.12', pythonLibrary: '7.2.7', sources: {} },
  controls: {},
  limitations: [
    'Bounded adaptation of CodeQL source/sink logic, not a complete CodeQL library or engine port.',
    'Express/Flask controls plus separately tested Next.js and worker input models; general request aliases and response sources remain unmodeled.',
    'Process API recognition uses Joern-resolved full names. Unresolved APIs and shadowing are not proven covered.',
    'Node child_process and Python subprocess command/executable positions only. Other libraries, indirect shell argument injection and sanitizer/constant-comparison barriers are not ported.',
    'Literal Python sequences select the first executable element; dynamic sequence values may produce coarse results.',
    'Passing these two positive/negative controls does not establish general precision, recall, or CodeQL equivalence.'
  ]
};
for (const filename of fs.readdirSync(path.join(root, 'upstream'))) {
  summary.provenance.sources[filename] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'upstream', filename))).digest('hex');
}
for (const [language, ruleId, wrapperFile, unsafeLine, safeLine] of [
  ['javascript', 'js/command-line-injection', 'wrappers.ts', 4, 8],
  ['python', 'py/command-line-injection', 'wrappers.py', 5, 9]
]) {
  const joern = read(path.join(root, `${language}-control.json`));
  assert.equal(joern.sources.length, 2, 'Both request values must be modeled');
  assert.equal(joern.processCalls.length, 2, 'Both safe and unsafe process calls must be examined');
  assert.equal(joern.commandArguments.length, 2, 'Safe calls must select their executable instead of disappearing from the model');
  assert.equal(joern.findings.length, 1);
  const finding = joern.findings[0];
  assert.equal(finding.ruleId, ruleId);
  assert.equal(finding.sink.file, wrapperFile);
  assert.equal(finding.sink.line, unsafeLine);
  assert.equal(new Set(finding.path.map(node => node.file)).size, 2, 'Trace must cross the imported helper');
  assert(finding.path[0].code.includes('command'));
  assert(!finding.path.some(node => node.code.includes('argument')));
  assert(joern.processCalls.some(call => call.line === safeLine));
  assert(joern.commandArguments.some(argument => /["']whoami["']/.test(argument.code)), 'Safe executable must remain a constant sink');
  const codeql = read(path.join(root, '..', '..', 'codeql', `control-${language}.sarif`));
  const baseline = codeql.runs.flatMap(run => run.results ?? []).filter(result => result.ruleId === ruleId);
  assert.equal(baseline.length, 1);
  const baselineLocation = baseline[0].locations[0].physicalLocation;
  assert(baselineLocation.artifactLocation.uri.endsWith(wrapperFile));
  assert.equal(baselineLocation.region.startLine, unsafeLine);
  summary.controls[language] = { unsafeDetected: true, safeFlagged: false, matchesExistingCodeqlControl: true, finding };
}
fs.writeFileSync(path.join(root, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log('PASS: Python and TypeScript each detect one cross-file unsafe command flow, leave safe argument-list execution unflagged, and match the existing CodeQL control results.');
