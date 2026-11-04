import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';

// dist/ is committed so `npm install --global github:...` needs no build step
// (npm's git-dependency `prepare` breaks under --global). Keep it in sync with src/.
const root = join(import.meta.dirname, '..', '..');
const HINT = 'dist/ is out of date: run `npm run build` and commit dist/.';

async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
}

test('committed dist/ matches a fresh build of src/', async () => {
  const out = await mkdtemp(join(tmpdir(), 'biblical-harness-dist-'));
  try {
    await promisify(execFile)(join(root, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.build.json', '--outDir', out], { cwd: root });
    const expected = await files(out);
    assert.deepEqual(await files(join(root, 'dist')).catch(() => []), expected, HINT);
    for (const file of expected) {
      assert.equal(await readFile(join(root, 'dist', file), 'utf8'), await readFile(join(out, file), 'utf8'), `${file}: ${HINT}`);
    }
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test('package.json runs the built CLI and ships it without a prepare step', async () => {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.bin, { 'biblical-harness': 'dist/cli/main.js' });
  // scripts/ ships because postinstall runs wherever the package is installed.
  for (const entry of ['dist', 'scripts', 'skills']) assert.ok(pkg.files.includes(entry), entry);
  assert.equal(pkg.scripts.prepare, undefined, 'a prepare script makes `npm install --global github:...` fail');
  assert.equal(pkg.scripts.prepack, 'npm run build');
  assert.equal(pkg.scripts.postinstall, 'node scripts/postinstall.mjs');
  const { stdout } = await promisify(execFile)('git', ['ls-files', '--stage', 'dist/cli/main.js'], { cwd: root });
  assert.match(stdout, /^100755 /, 'dist/cli/main.js must be committed executable: run `npm run build` and commit it.');
});
