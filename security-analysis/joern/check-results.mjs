import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const catalog = read('querydb.json');
const summary = {
  version: '4.0.650',
  bundledQueriesByLanguage: {},
  application: {},
  controls: {},
  limitations: [
    'Custom query recognizes only the explicit control request expressions and shell sinks; it is not a general security scanner.',
    'Six TypeScript source files were absent from the default frontend graph; cause not established.',
    'Control success demonstrates these examples, not CodeQL-equivalent coverage or precision.',
    'Windows query launcher used Java ReplBridge directly with the packaged classpath.'
  ]
};
for (const query of catalog) summary.bundledQueriesByLanguage[query.language] = (summary.bundledQueriesByLanguage[query.language] ?? 0) + 1;
for (const [language, prefix, manifest, sinkLine] of [
  ['javascript', 'src/', 'source-files.txt', 4],
  ['python', 'worker/src/', 'python-source-files.txt', 5]
]) {
  const graph = read(`${language}-graph.json`);
  const expected = fs.readFileSync(path.join(root, manifest), 'utf8').trim().split(/\r?\n/)
    .map(name => name.replaceAll('\\', '/')).filter(name => /\.(tsx?|jsx?|py)$/.test(name));
  const actual = graph.files.filter(name => name !== 'N/A').map(name => prefix + name.replaceAll('\\', '/'));
  summary.application[language] = {
    expectedFiles: expected.length, representedFiles: actual.length,
    missingFiles: expected.filter(name => !actual.includes(name)),
    methods: graph.methods, calls: graph.calls, securityAssessment: 'not performed'
  };
  assert(actual.length > 0);
  assert(actual.every(name => expected.includes(name)));
  const control = read(`control-${language}.json`);
  assert.equal(control.sources.length, 2, 'Both safe and unsafe request inputs must be selected');
  assert.equal(control.shellCalls.length, 1);
  assert.equal(control.flows.length, 1);
  const flow = control.flows[0];
  assert(flow[0].code.includes('command'));
  assert.equal(new Set(flow.map(node => node.file)).size, 2, 'Flow must cross files');
  assert.equal(flow.at(-1).line, sinkLine);
  assert(!flow.some(node => node.code.includes('argument')));
  summary.controls[language] = { unsafeFlowDetected: true, safeExampleFlagged: false, flow };
}
assert.equal(summary.bundledQueriesByLanguage.javascript ?? 0, 0);
assert.equal(summary.bundledQueriesByLanguage.python ?? 0, 0);
fs.writeFileSync(path.join(root, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log('PASS: both cross-file controls detected; safe examples unflagged. Coverage and limitations saved to summary.json.');
