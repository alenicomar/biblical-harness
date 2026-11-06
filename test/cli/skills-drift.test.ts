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

  // Agent skill loaders parse the frontmatter as strict YAML: an unquoted value containing ": "
  // is rejected and the skill is silently not loaded. Values must be double-quoted (JSON strings
  // are valid YAML double-quoted scalars) or a plain word that YAML cannot misread.
  test(`skills/${harness.id}/SKILL.md frontmatter is valid YAML with name and description`, () => {
    const frontmatter = renderSkill(harness).match(/^---\n([\s\S]*?)\n---\n/)?.[1];
    assert.ok(frontmatter, 'missing frontmatter');
    const fields = Object.fromEntries(
      frontmatter.split('\n').map((line) => {
        const [, key, value] = line.match(/^([a-z-]+): (.*)$/) ?? assert.fail(`not a key: value line: ${line}`);
        return [key, value];
      }),
    );
    assert.deepEqual(Object.keys(fields), ['name', 'description']);
    assert.match(fields.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.equal(fields.name, harness.id);
    assert.ok(fields.description.startsWith('"'), `description must be quoted: ${fields.description}`);
    assert.equal(JSON.parse(fields.description), harness.summary);
  });
}
