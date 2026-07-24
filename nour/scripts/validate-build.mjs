import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function filesUnder(directory, extension) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(full, extension));
    else if (!extension || full.endsWith(extension)) output.push(full);
  }
  return output;
}

for (const file of await filesUnder(path.join(root, 'data'), '.json')) {
  JSON.parse(await readFile(file, 'utf8'));
}

const scripts = [
  ...await filesUnder(path.join(root, 'js'), '.js'),
  path.join(root, 'sw.js'),
  path.join(root, 'server', 'cloudflare-worker.js'),
];
for (const file of scripts) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${path.relative(root, file)}\n${result.stderr}`);
}

const index = await readFile(path.join(root, 'index.html'), 'utf8');
assert.match(index, /<script\s+type="module"\s+src="(?:\.\/)?js\/app\.js"/);

const worker = await readFile(path.join(root, 'sw.js'), 'utf8');
const coreBlock = worker.match(/const CORE\s*=\s*\[([\s\S]*?)\];/)?.[1] || '';
for (const match of coreBlock.matchAll(/['"]\.\/([^'"]+)['"]/g)) {
  const relative = match[1].split(/[?#]/)[0];
  if (relative) await access(path.join(root, relative));
}

const learn = JSON.parse(await readFile(path.join(root, 'data', 'learn.json'), 'utf8'));
const wudu = learn.guides.find(guide => guide.id === 'wudu');
assert.deepEqual(
  wudu.steps.slice(6, 9).map(step => step.title),
  ['Essuyer la tête', 'Essuyer les oreilles', 'Laver les pieds'],
);
await access(path.join(root, 'assets', 'learn', 'wudu-ears.webp'));

console.log(`Nour validé : ${scripts.length} scripts, données JSON et précache PWA cohérents.`);
