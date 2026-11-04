import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, constants, lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';
import { main } from '../../src/cli/main.ts';
import { HARNESSES } from '../../src/harnesses/index.ts';
import { renderSkill } from '../../src/harness/skill.ts';

const root = join(import.meta.dirname, '..', '..');
const CLI = join(root, 'dist', 'cli', 'main.js');

async function run(argv: string[]) {
  let out = '';
  let err = '';
  const code = await main(argv, { stdout: (s) => (out += s), stderr: (s) => (err += s) });
  return { code, out, err };
}

async function sandbox() {
  const dir = await mkdtemp(join(tmpdir(), 'biblical-harness-setup-'));
  return { dir, bin: join(dir, 'bin'), skills: join(dir, 'skills') };
}

test('setup links the CLI into the bin dir and installs the skills', async () => {
  const box = await sandbox();
  try {
    const { code, out } = await run(['setup', '--bin-dir', box.bin, '--skills-dir', box.skills]);
    assert.equal(code, 0);
    const link = join(box.bin, 'biblical-harness');
    assert.ok((await lstat(link)).isSymbolicLink());
    assert.equal(await readlink(link), CLI);
    await access(CLI, constants.X_OK);
    for (const harness of HARNESSES) {
      assert.equal(await readFile(join(box.skills, harness.id, 'SKILL.md'), 'utf8'), renderSkill(harness));
    }
    assert.match(out, new RegExp(`Linked ${link} -> ${CLI}`));

    // Idempotent: a second run keeps the same link.
    assert.equal((await run(['setup', '--bin-dir', box.bin, '--skills-dir', box.skills])).code, 0);
    assert.equal(await readlink(link), CLI);
  } finally {
    await rm(box.dir, { recursive: true, force: true });
  }
});

test('setup warns when the bin dir is not on PATH', async () => {
  const box = await sandbox();
  const previous = process.env.PATH;
  try {
    process.env.PATH = ['/usr/bin', box.bin].join(delimiter);
    assert.doesNotMatch((await run(['setup', '--bin-dir', box.bin, '--skills-dir', box.skills])).out, /not on your PATH/);
    process.env.PATH = '/usr/bin';
    assert.match((await run(['setup', '--bin-dir', box.bin, '--skills-dir', box.skills])).out, /not on your PATH/);
  } finally {
    process.env.PATH = previous;
    await rm(box.dir, { recursive: true, force: true });
  }
});

test('setup never overwrites a regular file with the command name', async () => {
  const box = await sandbox();
  try {
    await mkdir(box.bin, { recursive: true });
    await writeFile(join(box.bin, 'biblical-harness'), 'mine');
    const { code, err } = await run(['setup', '--bin-dir', box.bin, '--skills-dir', box.skills]);
    assert.equal(code, 1);
    assert.match(err, /is not a symlink; remove it/);
    assert.equal(await readFile(join(box.bin, 'biblical-harness'), 'utf8'), 'mine');
  } finally {
    await rm(box.dir, { recursive: true, force: true });
  }
});

test('setup --remove deletes the link and the installed skills only', async () => {
  const box = await sandbox();
  try {
    await run(['setup', '--bin-dir', box.bin, '--skills-dir', box.skills]);
    await mkdir(join(box.skills, 'other-skill'), { recursive: true });
    const { code } = await run(['setup', '--remove', '--bin-dir', box.bin, '--skills-dir', box.skills]);
    assert.equal(code, 0);
    assert.deepEqual(await readdir(box.bin), []);
    assert.deepEqual(await readdir(box.skills), ['other-skill']);
  } finally {
    await rm(box.dir, { recursive: true, force: true });
  }
});

const postinstall = (env: Record<string, string>) =>
  promisify(execFile)(process.execPath, [join(root, 'scripts', 'postinstall.mjs')], {
    cwd: root,
    env: { PATH: process.env.PATH ?? '', ...env },
  });

test('postinstall sets up the user install only for npm install in the clone', async () => {
  const box = await sandbox();
  try {
    const env = { BIBLICAL_HARNESS_BIN_DIR: box.bin, BIBLICAL_HARNESS_SKILLS_DIR: box.skills };
    await postinstall({ ...env, INIT_CWD: tmpdir() }); // installed as a dependency elsewhere
    await postinstall({ ...env, INIT_CWD: root, CI: 'true' });
    await postinstall({ ...env, INIT_CWD: root, BIBLICAL_HARNESS_SKIP_SETUP: '1' });
    assert.deepEqual(await readdir(box.dir), []);

    const { stdout } = await postinstall({ ...env, INIT_CWD: root });
    assert.equal(await readlink(join(box.bin, 'biblical-harness')), CLI);
    assert.match(stdout, /Linked/);
  } finally {
    await rm(box.dir, { recursive: true, force: true });
  }
});

test('postinstall never fails the install', async () => {
  const box = await sandbox();
  try {
    await mkdir(box.bin, { recursive: true });
    await writeFile(join(box.bin, 'biblical-harness'), 'mine');
    const { stderr } = await postinstall({ BIBLICAL_HARNESS_BIN_DIR: box.bin, BIBLICAL_HARNESS_SKILLS_DIR: box.skills, INIT_CWD: root });
    assert.match(stderr, /setup did not finish/);
  } finally {
    await rm(box.dir, { recursive: true, force: true });
  }
});
