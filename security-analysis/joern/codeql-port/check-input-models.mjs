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
  const commandFindings = result.findings.filter(finding => finding.ruleId.endsWith('/command-line-injection'));
  const sourceLines = lines(filename);
  function bodyLine(name) {
    const index = sourceLines.findIndex(line => new RegExp(`(?:function|def) ${name}\\(`).test(line));
    assert(index >= 0, `Missing fixture ${name}`);
    return index + (language === 'python' ? (name.includes('constructed') ? 4 : name.includes('claimed') ? 3 : 2) : 1);
  }
  const fixtureFile = language === 'python' ? 'jobs.py' : 'routes.ts';
  const containsLine = (finding, line) => finding.path.some(node => node.file === fixtureFile && node.line === line);
  for (const name of unsafeNames) assert(commandFindings.some(finding => containsLine(finding, bodyLine(name))), `Must detect ${name}`);
  const lookalikes = language === 'python' ? [lookalike, 'unrelated_claimed'] : [lookalike];
  for (const name of [...safeNames, ...lookalikes]) {
    const line = bodyLine(name);
    assert(!result.findings.some(finding => containsLine(finding, line)), `Must not flag ${name}`);
    if (lookalikes.includes(name)) assert(!result.sources.some(source => source.file === fixtureFile && source.line === line), 'Unrelated object must not be a modeled boundary');
    else assert(result.sources.some(source => source.file === fixtureFile && source.line === line), `Safe input ${name} must still be modeled`);
  }
  assert.equal(result.processCalls.length, 2, 'Both imported process helpers must be represented');
  for (const finding of commandFindings) {
    assert.equal(finding.sink.line, sinkLine);
    assert.equal(new Set(finding.path.map(node => node.file)).size >= 2, true, 'Must trace into imported helper');
    assert(finding.sourceModel.startsWith(language === 'python' ? 'worker.' : 'nextjs.'));
  }
  const securityFile = language === 'python' ? 'security.py' : 'security.ts';
  const securityLines = lines(`input-controls/${language === 'python' ? 'python' : 'typescript'}/${securityFile}`);
  const expected = language === 'python' ? {
    unsafe_ssrf: 'ssrf', unsafe_ssrf_request: 'ssrf', unsafe_dynamic_origin: 'ssrf', unsafe_mutated_origin: 'ssrf', unsafe_sql: 'sql-injection', unsafe_path: 'path-traversal', unsafe_normalized_path: 'path-traversal',
    unsafe_redirect: 'open-redirect', unsafe_code: 'code-injection', unsafe_deserialization: 'unsafe-deserialization',
    unsafe_yaml: 'unsafe-deserialization', unsafe_logging: 'sensitive-logging',
  } : {
    unsafeSsrf: 'ssrf', unsafeDynamicOrigin: 'ssrf', unsafeSql: 'sql-injection', unsafePrisma: 'sql-injection', unsafePath: 'path-traversal',
    unsafeNormalizedPath: 'path-traversal', unsafeRedirect: 'open-redirect', unsafeCode: 'code-injection',
    unsafePrototype: 'prototype-pollution', unsafeLogging: 'sensitive-logging',
  };
  const prefix = language === 'python' ? 'py' : 'js';
  const controls = {};
  for (const [index, line] of securityLines.entries()) {
    const match = line.match(/(?:function|def) ((?:unsafe|safe|unrelated)\w*)\(/);
    if (!match) continue;
    const name = match[1];
    const sourceLine = index + (language === 'python' ? 2 : 1);
    const findings = result.findings.filter(finding => finding.path.some(node => node.file === securityFile && node.line === sourceLine));
    if (expected[name]) {
      const finding = findings.find(finding => finding.ruleId === `${prefix}/${expected[name]}`);
      assert(finding, `Must detect ${language} ${name} as ${expected[name]}`);
      assert(new Set(finding.path.map(node => node.file)).size >= 2, `${name} must cross the imported helper`);
      controls[name] = expected[name];
    } else {
      assert.equal(findings.length, 0, `Must not flag ${language} ${name}`);
      controls[name] = 'unflagged';
    }
  }
  assert.equal(Object.values(controls).filter(value => value !== 'unflagged').length, Object.keys(expected).length);
  summary.controls[language] = { unsafeCasesDetected: unsafeNames.length, safeCasesUnflagged: safeNames.length, unrelatedObjectsUnflagged: lookalikes.length, alerts: result.findings.length, models: [...new Set(result.sources.map(source => source.model))], securityRules: controls };
}
fs.writeFileSync(path.join(root, 'input-model-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
