import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HARNESSES } from '../../src/harnesses/index.ts';
import { renderSkill } from '../../src/harness/skill.ts';

for (const harness of HARNESSES) {
  test(`skills/${harness.id}/SKILL.md matches the harness definition`, async () => {
    const committed = await readFile(new URL(`../../skills/${harness.id}/SKILL.md`, import.meta.url), 'utf8');
    assert.equal(
      committed,
      renderSkill(harness),
      `skills/${harness.id}/SKILL.md is out of date with src/harnesses/${harness.id}.ts: run \`npm run skills\` and commit the result.`,
    );
  });
}
