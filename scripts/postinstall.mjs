// After `npm install` in a clone, install it for the user: link the command into
// ~/.local/bin and the skills into ~/.agents/skills (`biblical-harness setup`).
// Does nothing when the package is installed as a dependency or globally, in CI,
// or with BIBLICAL_HARNESS_SKIP_SETUP set; never fails the install.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const initCwd = process.env.INIT_CWD;
if (initCwd === undefined || resolve(initCwd) !== root || process.env.CI || process.env.BIBLICAL_HARNESS_SKIP_SETUP) {
  process.exit(0);
}

try {
  const { main } = await import('../dist/cli/main.js');
  const code = await main(['setup']);
  if (code !== 0) throw new Error(`exit code ${code}`);
} catch (error) {
  console.warn(`biblical-harness: setup did not finish (${error.message}). Fix it and run "npm run setup".`);
}
