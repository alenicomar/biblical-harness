import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// CI is the only remote gate before merging: it must run the same `npm run check` as local
// development (typecheck + tests, including the dist/ and skills/ drift tests) on every PR.
const root = join(import.meta.dirname, '..', '..');

test('the CI workflow runs npm ci and npm run check on Node 24 for pull requests and pushes to main', async () => {
  // Normalize CRLF so the test also holds in a Windows checkout with core.autocrlf.
  const workflow = (await readFile(join(root, '.github', 'workflows', 'ci.yml'), 'utf8')).replace(/\r\n/g, '\n');
  assert.match(workflow, /^on:\n {2}pull_request:\n {2}push:\n {4}branches: \[main\]\n/m);
  assert.match(workflow, /node-version: 24\n/);
  assert.match(workflow, /- run: npm ci\n/);
  assert.match(workflow, /- run: npm run check\n/);
});

test('the CI workflow never cancels or replaces a run on main and does not persist the checkout token', async () => {
  const workflow = (await readFile(join(root, '.github', 'workflows', 'ci.yml'), 'utf8')).replace(/\r\n/g, '\n');
  assert.match(workflow, /group: ci-\$\{\{ github\.event_name == 'pull_request' && github\.ref \|\| github\.sha \}\}\n/);
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}\n/);
  assert.match(workflow, /- uses: actions\/checkout@v5\n {8}with:\n {10}persist-credentials: false\n/);
});

test('the user-install postinstall is skipped in CI', async () => {
  const postinstall = await readFile(join(root, 'scripts', 'postinstall.mjs'), 'utf8');
  assert.match(postinstall, /process\.env\.CI \|\|/);
});
