import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BibleApiClient } from '../../src/core/client.ts';
import { gatherEvidence, HarnessInputError, parseInput } from '../../src/harness/contract.ts';
import { getProfile } from '../../src/harness/profiles.ts';
import { passageExegesis } from '../../src/harnesses/passage-exegesis.ts';
import { getHarness, HARNESSES } from '../../src/harnesses/index.ts';
import { chapterFixture, fakeFetch } from '../helpers/fake-fetch.ts';

const verses = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

function routes() {
  return {
    '/api/spa_r09/JHN/3.json': chapterFixture('spa_r09', 'JHN', 3, verses('es', 20), 'Nicodemo'),
    '/api/BSB/JHN/3.json': chapterFixture('BSB', 'JHN', 3, verses('en', 20)),
    '/api/grc_sbl/JHN/3.json': chapterFixture('grc_sbl', 'JHN', 3, verses('gr', 20)),
    '/api/spa_r09/ROM/5.json': chapterFixture('spa_r09', 'ROM', 5, verses('rom', 10)),
    '/api/spa_r09/NUM/21.json': chapterFixture('spa_r09', 'NUM', 21, verses('num', 10)),
    '/api/c/matthew-henry/JHN/3.json': {
      commentary: { id: 'matthew-henry', name: 'Matthew Henry Bible Commentary' },
      chapter: { number: 3, introduction: 'Intro.', content: [{ type: 'verse', number: 16, content: ['x'.repeat(50)] }] },
    },
    '/api/c/tyndale/JHN/3.json': {
      commentary: { id: 'tyndale', name: 'Tyndale Open Study Notes' },
      chapter: { number: 3, content: [{ type: 'verse', number: 16, content: ['3:16 God so loved.'] }] },
    },
    '/api/d/open-cross-ref/JHN/3.json': {
      chapter: {
        number: 3,
        content: [
          {
            verse: 16,
            references: [
              { book: 'ROM', chapter: 5, verse: 8, score: 900 },
              { book: 'JHN', chapter: 3, verse: 17, score: 400 },
              { book: 'NUM', chapter: 21, verse: 9, score: 3 },
            ],
          },
          { verse: 17, references: [{ book: 'NUM', chapter: 21, verse: 8, score: 60 }] },
        ],
      },
    },
  };
}

const context = (fetchImpl: typeof fetch) => ({
  client: new BibleApiClient({ fetch: fetchImpl }),
  profile: getProfile(),
  language: 'es',
});

test('registry exposes passage-exegesis', () => {
  assert.equal(getHarness('passage-exegesis'), passageExegesis);
  assert.ok(HARNESSES.includes(passageExegesis));
  assert.throws(() => getHarness('nope'), /Unknown harness "nope".*passage-exegesis/);
});

test('input defaults: RV1909, original text on, no comparisons', () => {
  const input = parseInput(passageExegesis, { reference: 'Jn 3:16-17' });
  assert.equal(input.translation, 'spa_r09');
  assert.equal(input.original, true);
  assert.deepEqual(input.compare, []);
  assert.equal(input.contextVerses, 5);
});

test('input rejects unparseable references and unknown commentaries', () => {
  assert.throws(() => parseInput(passageExegesis, { reference: 'Tobías 1:1' }), (error: unknown) =>
    error instanceof HarnessInputError && /reference.*unknown book "Tobías"/.test(error.message));
  assert.throws(() => parseInput(passageExegesis, { reference: 'Jn 3:16', commentaries: ['wikipedia'] }), HarnessInputError);
});

test('gathers passage, context, comparisons, original, commentaries and cross references', async () => {
  const fake = fakeFetch(routes());
  const { bundle } = await gatherEvidence(
    passageExegesis,
    { reference: 'Jn 3:16-17', compare: ['BSB'], contextVerses: 2, commentaries: ['matthew-henry', 'jamieson-fausset-brown', 'tyndale'], commentaryCharLimit: 20, minCrossReferenceScore: 5 },
    context(fake.fetch),
  );

  assert.equal(bundle.reference, 'Juan 3:16-17');
  assert.deepEqual(bundle.book, { id: 'JHN', name: 'Juan', testament: 'NT' });
  assert.deepEqual(bundle.passage.verses.map((v) => v.text), ['es16', 'es17']);
  assert.deepEqual(bundle.context.before.map((v) => v.verse), [14, 15]);
  assert.deepEqual(bundle.context.after.map((v) => v.verse), [18, 19]);
  assert.deepEqual(bundle.comparisons.map((p) => [p.translation.id, p.verses.map((v) => v.text)]), [['BSB', ['en16', 'en17']]]);
  assert.equal(bundle.original?.translation.id, 'grc_sbl');
  assert.deepEqual(bundle.original?.verses.map((v) => v.text), ['gr16', 'gr17']);

  assert.deepEqual(bundle.commentaries.map((c) => c.commentary.id), ['matthew-henry', 'tyndale']);
  assert.deepEqual(bundle.unavailableCommentaries, ['jamieson-fausset-brown']);
  const henry = bundle.commentaries[0]!;
  assert.equal(henry.notes[0]?.text, `${'x'.repeat(20)} […truncated]`);

  // Jn 3:17 lies inside the passage and NUM 21:9 is under the score floor.
  assert.deepEqual(bundle.crossReferences.map((r) => [r.reference, r.text]), [
    ['Romanos 5:8', 'rom8'],
    ['Números 21:8', 'num8'],
  ]);
  assert.ok(bundle.sources.some((s) => s.includes('open-cross-ref')));
});

test('OT passages default to the Hebrew text and Keil-Delitzsch', async () => {
  const fake = fakeFetch({
    '/api/spa_r09/PSA/23.json': chapterFixture('spa_r09', 'PSA', 23, verses('es', 6)),
    '/api/hbo_wlc/PSA/23.json': chapterFixture('hbo_wlc', 'PSA', 23, verses('he', 6)),
    '/api/d/open-cross-ref/PSA/23.json': { chapter: { number: 23, content: [] } },
  });
  const { input, bundle } = await gatherEvidence(passageExegesis, { reference: 'Sal 23' }, context(fake.fetch));

  assert.deepEqual(input.commentaries, undefined);
  assert.equal(bundle.original?.translation.id, 'hbo_wlc');
  assert.deepEqual(bundle.context, { before: [], after: [] });
  assert.ok(fake.calls.some((url) => url.endsWith('/api/c/keil-delitzsch/PSA/23.json')));
  assert.deepEqual(bundle.unavailableCommentaries, ['keil-delitzsch', 'matthew-henry', 'tyndale']);
});
