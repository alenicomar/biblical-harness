import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { BibleApiClient } from '../../src/core/client.ts';
import { defineHarness, HarnessInputError, HarnessOutputError, runHarness } from '../../src/harness/contract.ts';
import { buildPrompt } from '../../src/harness/prompt.ts';
import { renderSkill } from '../../src/harness/skill.ts';
import { DEFAULT_PROFILE_ID, getProfile, PROFILES } from '../../src/harness/profiles.ts';
import { SHARED_GUARDRAILS } from '../../src/harness/guardrails.ts';
import type { LlmProvider } from '../../src/harness/llm.ts';
import { fakeFetch } from '../helpers/fake-fetch.ts';

const toy = defineHarness({
  id: 'toy-study',
  title: 'Toy study',
  summary: 'Use when testing the harness contract.',
  input: z.object({ reference: z.string().describe('Passage, e.g. "Jn 3:16"') }),
  output: z.object({ summary: z.string(), verses: z.array(z.string()) }),
  method: ['Read the passage.', 'Summarize it.'],
  guardrails: ['Toy-specific rule.'],
  async gather(input) {
    return { echoed: input.reference };
  },
});

const ctx = () => ({
  client: new BibleApiClient({ fetch: fakeFetch({}).fetch }),
  profile: getProfile(),
  language: 'es',
});

function provider(reply: string): LlmProvider & { requests: Array<{ system: string; user: string }> } {
  const requests: Array<{ system: string; user: string }> = [];
  return {
    name: 'fake',
    requests,
    async complete(request) {
      requests.push(request);
      return reply;
    },
  };
}

test('profiles: plural is the default and unknown ids list the valid ones', () => {
  assert.equal(DEFAULT_PROFILE_ID, 'plural');
  assert.equal(getProfile().id, 'plural');
  assert.equal(getProfile('reformed').id, 'reformed');
  assert.throws(() => getProfile('catholic'), /Unknown doctrinal profile "catholic".*plural.*reformed.*baptist.*pentecostal/);
  const ids = PROFILES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const profile of PROFILES) {
    assert.ok(profile.instructions.length > 0, profile.id);
    assert.ok(profile.nameEs.length > 0, profile.id);
  }
});

test('buildPrompt puts guardrails, profile, language and output schema in the system prompt', () => {
  const profile = getProfile('baptist');
  const prompt = buildPrompt(toy, { input: { reference: 'Jn 3:16' }, bundle: { echoed: 'Jn 3:16' }, profile, language: 'es' });

  for (const rule of SHARED_GUARDRAILS) assert.ok(prompt.system.includes(rule), rule);
  assert.ok(prompt.system.includes('Toy-specific rule.'));
  assert.ok(prompt.system.includes(profile.name));
  assert.ok(prompt.system.includes(profile.instructions));
  assert.ok(prompt.system.includes('Spanish'));
  assert.ok(prompt.system.includes('"verses"'), 'output JSON schema is embedded');

  assert.ok(prompt.user.includes('1. Read the passage.'));
  assert.ok(prompt.user.includes('2. Summarize it.'));
  assert.ok(prompt.user.includes('"reference": "Jn 3:16"'));
  assert.ok(prompt.user.includes('"echoed": "Jn 3:16"'));
});

test('renderSkill produces a SKILL.md with frontmatter, gather command, method, guardrails and profiles', () => {
  const skill = renderSkill(toy);

  assert.match(skill, /^---\nname: toy-study\ndescription: Use when testing the harness contract\.\n---\n/);
  assert.ok(skill.includes('biblical-harness gather toy-study --input'));
  assert.ok(skill.includes('Passage, e.g. \\"Jn 3:16\\"') || skill.includes('Passage, e.g. "Jn 3:16"'));
  assert.ok(skill.includes('1. Read the passage.'));
  assert.ok(skill.includes('Toy-specific rule.'));
  for (const rule of SHARED_GUARDRAILS) assert.ok(skill.includes(rule), rule);
  for (const profile of PROFILES) assert.ok(skill.includes(`\`${profile.id}\``), profile.id);
  assert.ok(skill.includes('"verses"'));
});

test('runHarness validates input, gathers evidence, calls the provider and validates the report', async () => {
  const llm = provider('```json\n{"summary":"ok","verses":["Jn 3:16"]}\n```');

  const result = await runHarness(toy, { reference: 'Jn 3:16' }, { ...ctx(), provider: llm });

  assert.deepEqual(result.report, { summary: 'ok', verses: ['Jn 3:16'] });
  assert.deepEqual(result.bundle, { echoed: 'Jn 3:16' });
  assert.equal(llm.requests.length, 1);
  assert.equal(llm.requests[0]?.system, result.prompt.system);
});

test('runHarness rejects invalid input before gathering or calling the provider', async () => {
  const llm = provider('{}');
  await assert.rejects(runHarness(toy, { reference: 3 }, { ...ctx(), provider: llm }), HarnessInputError);
  assert.equal(llm.requests.length, 0);
});

test('runHarness reports non-JSON and schema-violating replies as HarnessOutputError', async () => {
  await assert.rejects(
    runHarness(toy, { reference: 'Jn 3:16' }, { ...ctx(), provider: provider('Lo siento, no puedo.') }),
    (error: unknown) => error instanceof HarnessOutputError && /not valid JSON/.test(error.message),
  );
  await assert.rejects(
    runHarness(toy, { reference: 'Jn 3:16' }, { ...ctx(), provider: provider('{"summary":"ok"}') }),
    (error: unknown) => error instanceof HarnessOutputError && /verses/.test(error.message),
  );
});
