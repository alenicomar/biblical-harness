import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../../src/cli/main.ts';
import { HARNESSES } from '../../src/harnesses/index.ts';
import { renderSkill } from '../../src/harness/skill.ts';
import { chapterFixture, fakeFetch } from '../helpers/fake-fetch.ts';

const verses = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

function routes(): Record<string, unknown> {
  return {
    '/api/spa_r09/JHN/3.json': chapterFixture('spa_r09', 'JHN', 3, verses('es', 20), 'Nicodemo'),
    '/api/BSB/JHN/3.json': chapterFixture('BSB', 'JHN', 3, verses('en', 20)),
    '/api/grc_sbl/JHN/3.json': chapterFixture('grc_sbl', 'JHN', 3, verses('gr', 20)),
    '/api/spa_r09/ROM/5.json': chapterFixture('spa_r09', 'ROM', 5, verses('rom', 10)),
    '/api/d/open-cross-ref/JHN/3.json': {
      chapter: {
        number: 3,
        content: [
          {
            verse: 16,
            references: [
              { book: 'ROM', chapter: 5, verse: 8, score: 900 },
              { book: 'JHN', chapter: 3, verse: 17, score: 400 },
              { book: 'ROM', chapter: 5, verse: 9, score: 3 },
            ],
          },
        ],
      },
    },
    '/api/available_translations.json': {
      translations: [
        { id: 'spa_r09', name: 'Reina Valera 1909', englishName: 'Reina Valera 1909', language: 'spa' },
        { id: 'BSB', name: 'Berean Standard Bible', englishName: 'Berean Standard Bible', language: 'eng' },
      ],
    },
    '/api/available_commentaries.json': {
      commentaries: [{ id: 'matthew-henry', name: 'Matthew Henry Bible Commentary' }],
    },
  };
}

interface Result {
  code: number;
  out: string;
  err: string;
  calls: string[];
}

/** Drives `main` with a fake fetch; `--no-cache` is appended so no test touches the real cache dir. */
async function cli(argv: string[], served: Record<string, unknown> = routes(), statusFor: Record<string, number> = {}, cwd?: string): Promise<Result> {
  const fake = fakeFetch(served, statusFor);
  let out = '';
  let err = '';
  const args = argv.length === 0 || argv[0]!.startsWith('-') ? argv : [...argv, '--no-cache'];
  const code = await main(args, { stdout: (s) => (out += s), stderr: (s) => (err += s), fetch: fake.fetch, cwd });
  return { code, out, err, calls: fake.calls };
}

const EXEGESIS_INPUT = JSON.stringify({ reference: 'Jn 3:16-17', commentaries: [] });

test('no arguments and --help list the commands', async () => {
  for (const argv of [[], ['--help']]) {
    const { code, out } = await cli(argv);
    assert.equal(code, 0);
    for (const name of ['passage', 'xref', 'translations', 'commentaries', 'harnesses', 'profiles', 'gather', 'prompt', 'run', 'skills']) {
      assert.match(out, new RegExp(`^\\s+${name}\\b`, 'm'));
    }
  }
});

test('every command answers --help with its usage', async () => {
  for (const name of ['passage', 'xref', 'translations', 'commentaries', 'harnesses', 'profiles', 'gather', 'prompt', 'run', 'skills']) {
    const { code, out, err } = await cli([name, '--help']);
    assert.equal(code, 0, name);
    assert.match(out, new RegExp(`Usage: bible-ai ${name}`), name);
    assert.equal(err, '', name);
  }
});

test('passage prints a header and numbered verses', async () => {
  const { code, out, err, calls } = await cli(['passage', 'Jn 3:16-17']);
  assert.equal(code, 0);
  assert.equal(err, '');
  assert.deepEqual(out.trimEnd().split('\n'), ['Juan 3:16-17 (spa_r09 name)', '16 es16', '17 es17']);
  assert.deepEqual(calls, ['https://bible.helloao.org/api/spa_r09/JHN/3.json']);
});

test('passage --translation picks another text and --json prints the Passage object', async () => {
  const { code, out } = await cli(['passage', 'Jn 3:16', '--translation', 'BSB', '--json']);
  assert.equal(code, 0);
  const passage = JSON.parse(out);
  assert.equal(passage.reference, 'Juan 3:16');
  assert.equal(passage.translation.id, 'BSB');
  assert.deepEqual(passage.verses, [{ chapter: 3, verse: 16, text: 'en16' }]);
});

test('passage across chapters prefixes verses with the chapter', async () => {
  const served = { ...routes(), '/api/spa_r09/JHN/4.json': chapterFixture('spa_r09', 'JHN', 4, verses('es4-', 3)) };
  const { code, out } = await cli(['passage', 'Jn 3:20-4:1'], served);
  assert.equal(code, 0);
  assert.deepEqual(out.trimEnd().split('\n').slice(1), ['3:20 es20', '4:1 es4-1']);
});

test('xref prints one line per link, strongest first', async () => {
  const { code, out } = await cli(['xref', 'Jn 3:16']);
  assert.equal(code, 0);
  assert.deepEqual(out.trimEnd().split('\n'), [
    '3:16 -> Romanos 5:8 (900)',
    '3:16 -> Juan 3:17 (400)',
    '3:16 -> Romanos 5:9 (3)',
  ]);
});

test('xref honours --limit and --min-score, and --json is not required', async () => {
  const limited = await cli(['xref', 'Jn 3:16', '--limit', '1']);
  assert.deepEqual(limited.out.trimEnd().split('\n'), ['3:16 -> Romanos 5:8 (900)']);
  const scored = await cli(['xref', 'Jn 3:16', '--min-score', '100']);
  assert.deepEqual(scored.out.trimEnd().split('\n'), ['3:16 -> Romanos 5:8 (900)', '3:16 -> Juan 3:17 (400)']);
});

test('xref --json prints the links', async () => {
  const { code, out } = await cli(['xref', 'Jn 3:16', '--limit', '1', '--json']);
  assert.equal(code, 0);
  const links = JSON.parse(out);
  assert.equal(links.length, 1);
  assert.equal(links[0].reference, 'Romanos 5:8');
});

test('xref rejects a non-numeric --limit', async () => {
  const { code, err } = await cli(['xref', 'Jn 3:16', '--limit', 'many']);
  assert.equal(code, 2);
  assert.match(err, /--limit/);
});

test('translations lists id | name | englishName and filters by --lang', async () => {
  const all = await cli(['translations']);
  assert.equal(all.code, 0);
  assert.deepEqual(all.out.trimEnd().split('\n'), [
    'spa_r09 | Reina Valera 1909 | Reina Valera 1909',
    'BSB | Berean Standard Bible | Berean Standard Bible',
  ]);
  const spanish = await cli(['translations', '--lang', 'spa']);
  assert.deepEqual(spanish.out.trimEnd().split('\n'), ['spa_r09 | Reina Valera 1909 | Reina Valera 1909']);
});

test('commentaries lists id | name', async () => {
  const { code, out } = await cli(['commentaries']);
  assert.equal(code, 0);
  assert.equal(out.trimEnd(), 'matthew-henry | Matthew Henry Bible Commentary');
});

test('harnesses lists id: summary for every harness', async () => {
  const { code, out } = await cli(['harnesses']);
  assert.equal(code, 0);
  assert.deepEqual(out.trimEnd().split('\n'), HARNESSES.map((h) => `${h.id}: ${h.summary}`));
});

test('profiles marks the default and show prints the details', async () => {
  const list = await cli(['profiles']);
  assert.equal(list.code, 0);
  const lines = list.out.trimEnd().split('\n');
  assert.equal(lines[0], 'plural (default) | Evangelical plural | Evangélico plural');
  assert.ok(lines.includes('reformed | Reformed / Presbyterian | Reformada / Presbiteriana'));

  const show = await cli(['profiles', 'show', 'reformed']);
  assert.equal(show.code, 0);
  assert.match(show.out, /Reformed \/ Presbyterian/);
  assert.match(show.out, /Westminster Confession of Faith/);
  assert.match(show.out, /covenant theology/);
  assert.match(show.out, /Interpret from within the Reformed tradition/);
});

test('profiles show with an unknown id is a usage error', async () => {
  const { code, err } = await cli(['profiles', 'show', 'gnostic']);
  assert.equal(code, 2);
  assert.match(err, /Unknown doctrinal profile "gnostic".*reformed/);
  assert.match(err, /--help/);
});

test('gather prints the evidence bundle as pretty JSON', async () => {
  const { code, out } = await cli(['gather', 'passage-exegesis', '--input', EXEGESIS_INPUT]);
  assert.equal(code, 0);
  const bundle = JSON.parse(out);
  assert.equal(bundle.reference, 'Juan 3:16-17');
  assert.deepEqual(bundle.passage.verses.map((v: { text: string }) => v.text), ['es16', 'es17']);
  assert.match(out, /\n {2}"reference"/);
});

test('gather reads --input @file.json relative to the working directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bible-ai-cli-'));
  try {
    await writeFile(join(dir, 'input.json'), EXEGESIS_INPUT);
    const { code, out } = await cli(['gather', 'passage-exegesis', '--input', '@input.json'], routes(), {}, dir);
    assert.equal(code, 0);
    assert.equal(JSON.parse(out).reference, 'Juan 3:16-17');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('gather usage errors: missing harness, unknown harness, missing or invalid input, unknown profile', async () => {
  const cases: Array<[string[], RegExp]> = [
    [['gather'], /missing <harness>/i],
    [['gather', 'nope', '--input', '{}'], /Unknown harness "nope".*passage-exegesis/],
    [['gather', 'passage-exegesis'], /--input is required/],
    [['gather', 'passage-exegesis', '--input', '{not json'], /--input.*valid JSON/i],
    [['gather', 'passage-exegesis', '--input', '@missing-file.json'], /missing-file\.json/],
    [['gather', 'passage-exegesis', '--input', EXEGESIS_INPUT, '--profile', 'gnostic'], /Unknown doctrinal profile "gnostic"/],
  ];
  for (const [argv, message] of cases) {
    const { code, out, err } = await cli(argv);
    assert.equal(code, 2, argv.join(' '));
    assert.equal(out, '', argv.join(' '));
    assert.match(err, message, argv.join(' '));
    assert.match(err, /--help/, argv.join(' '));
  }
});

test('gather runtime errors exit 1 with the message and no stack trace', async () => {
  const unknownBook = await cli(['gather', 'passage-exegesis', '--input', '{"reference":"Tobías 1:1"}']);
  assert.equal(unknownBook.code, 1);
  assert.match(unknownBook.err, /unknown book "Tobías"/);
  assert.doesNotMatch(unknownBook.err, /\n\s+at /);

  const missingField = await cli(['gather', 'passage-exegesis', '--input', '{}']);
  assert.equal(missingField.code, 1);
  assert.match(missingField.err, /Invalid input for harness "passage-exegesis"/);
});

test('API failures exit 1 and mention the status', async () => {
  const { code, out, err } = await cli(['passage', 'Jn 3:16'], routes(), { '/api/spa_r09/JHN/3.json': 503 });
  assert.equal(code, 1);
  assert.equal(out, '');
  assert.match(err, /503/);
});

test('an unparseable reference exits 1', async () => {
  const { code, err } = await cli(['passage', 'Tobías 1:1']);
  assert.equal(code, 1);
  assert.match(err, /unknown book "Tobías"/);
});

test('prompt prints the system and user prompts without an API key', async () => {
  const { code, out } = await cli(['prompt', 'passage-exegesis', '--input', EXEGESIS_INPUT, '--profile', 'reformed', '--lang', 'en']);
  assert.equal(code, 0);
  assert.ok(out.startsWith('# SYSTEM\n'));
  assert.ok(out.indexOf('# SYSTEM') < out.indexOf('# USER'));
  assert.match(out, /Doctrinal profile: Reformed \/ Presbyterian/);
  assert.match(out, /# USER\n# Task: /);
  assert.match(out, /"es16"/);
});

test('prompt defaults to the plural profile', async () => {
  const { out } = await cli(['prompt', 'passage-exegesis', '--input', EXEGESIS_INPUT]);
  assert.match(out, /Doctrinal profile: Evangelical plural/);
});

async function withApiKey<T>(value: string | undefined, body: () => Promise<T>): Promise<T> {
  const previous = process.env.ANTHROPIC_API_KEY;
  if (value === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = value;
  try {
    return await body();
  } finally {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  }
}

test('run without ANTHROPIC_API_KEY exits 1 and names the variable', async () => {
  const { code, out, err } = await withApiKey(undefined, () => cli(['run', 'passage-exegesis', '--input', EXEGESIS_INPUT]));
  assert.equal(code, 1);
  assert.equal(out, '');
  assert.match(err, /ANTHROPIC_API_KEY/);
});

test('run reports an unusable model reply as a runtime error', async () => {
  const served = { ...routes(), '/v1/messages': { content: [{ type: 'text', text: 'no json here' }] } };
  const { code, err, calls } = await withApiKey('test-key', () =>
    cli(['run', 'passage-exegesis', '--input', EXEGESIS_INPUT, '--model', 'm', '--max-tokens', '100'], served),
  );
  assert.equal(code, 1);
  assert.match(err, /unusable model reply/);
  assert.ok(calls.some((url) => url.endsWith('/v1/messages')));
});

test('run prints the validated report JSON', async () => {
  const report = {
    theme: 'amor',
    definition: 'd',
    canonicalProgression: [],
    keyPassages: [{ reference: 'Romanos 5:8', role: 'r' }],
    synthesis: 's',
    christologicalFocus: 'c',
    disputedPoints: [],
    application: [],
    gaps: [],
    sources: ['spa_r09'],
  };
  const served = {
    ...routes(),
    '/api/d/open-cross-ref/ROM/5.json': { chapter: { number: 5, content: [] } },
    '/v1/messages': { content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(report)}\n\`\`\`` }] },
  };
  const { code, out, err } = await withApiKey('test-key', () =>
    cli(['run', 'thematic-study', '--input', '{"theme":"amor","seeds":["Jn 3:16"]}'], served),
  );
  assert.equal(err, '');
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out), report);
});

test('run rejects a reply that does not match the report schema', async () => {
  const served = { ...routes(), '/v1/messages': { content: [{ type: 'text', text: '{"ok":true}' }] } };
  const { code, out, err } = await withApiKey('test-key', () =>
    cli(['run', 'passage-exegesis', '--input', EXEGESIS_INPUT], served),
  );
  assert.equal(code, 1);
  assert.equal(out, '');
  assert.match(err, /unusable model reply/);
});

test('skills build writes one SKILL.md per harness into --out', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bible-ai-skills-'));
  try {
    const { code, out } = await cli(['skills', 'build', '--out', dir]);
    assert.equal(code, 0);
    for (const harness of HARNESSES) {
      const path = join(dir, harness.id, 'SKILL.md');
      assert.equal(await readFile(path, 'utf8'), renderSkill(harness));
      assert.ok(out.includes(path));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('skills without the build subcommand is a usage error', async () => {
  const { code, err } = await cli(['skills']);
  assert.equal(code, 2);
  assert.match(err, /skills build/);
});

test('unknown commands and options are usage errors', async () => {
  const command = await cli(['frobnicate']);
  assert.equal(command.code, 2);
  assert.match(command.err, /Unknown command "frobnicate"/);
  assert.match(command.err, /bible-ai --help/);

  const option = await cli(['passage', 'Jn 3:16', '--verbose']);
  assert.equal(option.code, 2);
  assert.match(option.err, /--verbose/);
  assert.match(option.err, /--help/);
});

test('passage without a reference is a usage error', async () => {
  const { code, out, err } = await cli(['passage']);
  assert.equal(code, 2);
  assert.equal(out, '');
  assert.match(err, /missing <ref>/i);
  assert.match(err, /passage --help/);
});
