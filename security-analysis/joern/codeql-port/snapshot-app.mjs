import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const trialRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(trialRoot, '..', '..', '..');
const runName = process.argv[2] ?? 'application';
if (!/^[a-z0-9-]+$/.test(runName)) throw new Error('Use a simple run directory name');
const destination = path.join(trialRoot, runName);
const sourceRoot = path.join(destination, 'source');
if (fs.existsSync(sourceRoot)) throw new Error('Snapshot already exists; preserve this run and choose a fresh output directory');
const files = [];
function visit(relative) {
  for (const entry of fs.readdirSync(path.join(repoRoot, relative), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const name = path.join(relative, entry.name);
    if (entry.isDirectory()) visit(name);
    else if (/\.(?:tsx?|jsx?|mjs|cjs|py)$/.test(entry.name)) files.push(name);
  }
}
for (const directory of ['src', 'worker/src', 'scripts']) visit(directory);
for (const entry of fs.readdirSync(repoRoot, { withFileTypes: true })) {
  if (entry.isFile() && /\.(?:tsx?|jsx?|mjs|cjs)$/.test(entry.name)) files.push(entry.name);
}
const manifest = {
  capturedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
  scope: ['src', 'worker/src', 'scripts', 'root JavaScript/TypeScript configuration files'],
  files: []
};
for (const relative of files.sort()) {
  const bytes = fs.readFileSync(path.join(repoRoot, relative));
  const target = path.join(sourceRoot, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  manifest.files.push({ path: relative.replaceAll('\\', '/'), sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
}
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Captured ${files.length} source files for a stable analysis snapshot.`);
