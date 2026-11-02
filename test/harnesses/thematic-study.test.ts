import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BibleApiClient } from '../../src/core/client.ts';
import { gatherEvidence, HarnessInputError, parseInput } from '../../src/harness/contract.ts';
import { getProfile } from '../../src/harness/profiles.ts';
import { getHarness, HARNESSES } from '../../src/harnesses/index.ts';
import { canonicalSection, thematicStudy } from '../../src/harnesses/thematic-study.ts';
import { chapterFixture, fakeFetch } from '../helpers/fake-fetch.ts';

const verses = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

const crossRefs = (chapter: number, content: Array<{ verse: number; references: Array<{ book: string; chapter: number; verse: number; score: number }> }>) => ({
  chapter: { number: chapter, content },
});

function routes() {
  return {
    '/api/spa_r09/ROM/3.json': chapterFixture('spa_r09', 'ROM', 3, verses('rom', 31)),
    '/api/spa_r09/GAL/2.json': chapterFixture('spa_r09', 'GAL', 2, verses('gal', 21)),
    '/api/spa_r09/GEN/15.json': chapterFixture('spa_r09', 'GEN', 15, verses('gen', 21)),
    '/api/spa_r09/PSA/143.json': chapterFixture('spa_r09', 'PSA', 143, verses('psa', 12)),
    '/api/spa_r09/HAB/2.json': chapterFixture('spa_r09', 'HAB', 2, verses('hab', 20)),
    '/api/spa_r09/PSA/106.json': chapterFixture('spa_r09', 'PSA', 106, verses('psa106-', 48)),
    '/api/spa_r09/ROM/1.json': chapterFixture('spa_r09', 'ROM', 1, verses('rom1-', 32)),
    '/api/d/open-cross-ref/ROM/3.json': crossRefs(3, [
      {
        verse: 28,
        references: [
          { book: 'GEN', chapter: 15, verse: 6, score: 80 },
          { book: 'GAL', chapter: 2, verse: 16, score: 50 }, // inside the second seed
          { book: 'HAB', chapter: 2, verse: 4, score: 40 },
          { book: 'EPH', chapter: 2, verse: 8, score: 4 }, // under the score floor
        ],
      },
    ]),
    '/api/d/open-cross-ref/GAL/2.json': crossRefs(2, [
      {
        verse: 16,
        references: [
          { book: 'HAB', chapter: 2, verse: 4, score: 20 },
          { book: 'PSA', chapter: 143, verse: 2, score: 70 },
          { book: 'GEN', chapter: 15, verse: 6, score: 30 },
        ],
      },
    ]),
    '/api/d/open-cross-ref/GEN/15.json': crossRefs(15, [
      {
        verse: 6,
        references: [
          { book: 'HAB', chapter: 2, verse: 4, score: 25 },
          { book: 'PSA', chapter: 106, verse: 31, score: 30 },
          { book: 'ROM', chapter: 3, verse: 28, score: 90 }, // back inside the seed
        ],
      },
    ]),
    '/api/d/open-cross-ref/HAB/2.json': crossRefs(2, [{ verse: 4, references: [{ book: 'ROM', chapter: 1, verse: 17, score: 50 }] }]),
  };
}

const context = (fetchImpl: typeof fetch) => ({
  client: new BibleApiClient({ fetch: fetchImpl }),
  profile: getProfile(),
  language: 'es',
});

const THEME = 'justificación por la fe';

test('registry exposes thematic-study', () => {
  assert.equal(getHarness('thematic-study'), thematicStudy);
  assert.ok(HARNESSES.includes(thematicStudy));
});

test('input defaults: RV1909, depth 1, 30 passages, score floor 10', () => {
  const input = parseInput(thematicStudy, { theme: THEME, seeds: ['Ro 3:28'] });
  assert.equal(input.translation, 'spa_r09');
  assert.equal(input.depth, 1);
  assert.equal(input.crossReferencesPerVerse, 5);
  assert.equal(input.minCrossReferenceScore, 10);
  assert.equal(input.maxPassages, 30);
});

test('input rejects empty seeds, unparseable seeds, short themes and bad depth', () => {
  assert.throws(() => parseInput(thematicStudy, { theme: THEME, seeds: [] }), HarnessInputError);
  assert.throws(() => parseInput(thematicStudy, { theme: THEME, seeds: ['Tobías 1:1'] }), (error: unknown) =>
    error instanceof HarnessInputError && /seeds\.0.*unknown book "Tobías"/.test(error.message));
  assert.throws(() => parseInput(thematicStudy, { theme: 'x', seeds: ['Ro 3:28'] }), (error: unknown) =>
    error instanceof HarnessInputError && /theme/.test(error.message));
  assert.throws(() => parseInput(thematicStudy, { theme: THEME, seeds: ['Ro 3:28'], depth: 3 }), HarnessInputError);
});

test('depth 1 aggregates links across seeds in canonical order with texts and sections', async () => {
  const fake = fakeFetch(routes());
  const { bundle } = await gatherEvidence(thematicStudy, { theme: THEME, seeds: ['Ro 3:28', 'Gá 2:16'] }, context(fake.fetch));

  assert.equal(bundle.theme, THEME);
  assert.deepEqual(bundle.seeds, [
    { reference: 'Romanos 3:28', text: 'rom28' },
    { reference: 'Gálatas 2:16', text: 'gal16' },
  ]);

  // Gal 2:16 is a seed (excluded), Ef 2:8 is under the floor; canonical order: Gn, Sal, Hab.
  assert.deepEqual(
    bundle.passages.map((p) => [p.reference, p.score, p.depth, p.linkedFrom, p.text]),
    [
      ['Génesis 15:6', 110, 1, ['Romanos 3:28', 'Gálatas 2:16'], 'gen6'],
      ['Salmos 143:2', 70, 1, ['Gálatas 2:16'], 'psa2'],
      ['Habacuc 2:4', 60, 1, ['Romanos 3:28', 'Gálatas 2:16'], 'hab4'],
    ],
  );
  assert.deepEqual(
    bundle.passages.map((p) => [p.book, p.testament, p.section]),
    [
      ['Génesis', 'OT', 'Law'],
      ['Salmos', 'OT', 'Wisdom & Poetry'],
      ['Habacuc', 'OT', 'Minor Prophets'],
    ],
  );
  assert.deepEqual(bundle.passages[0]!.ref, { book: 'GEN', startChapter: 15, startVerse: 6, endChapter: 15, endVerse: 6 });
  assert.ok(bundle.sources.some((s) => s.includes('spa_r09')));
  assert.ok(bundle.sources.some((s) => s.includes('open-cross-ref')));
});

test('depth 1 applies the score floor and the per-verse limit', async () => {
  const fake = fakeFetch(routes());
  const { bundle } = await gatherEvidence(
    thematicStudy,
    { theme: THEME, seeds: ['Gá 2:16'], minCrossReferenceScore: 25, crossReferencesPerVerse: 2 },
    context(fake.fetch),
  );
  assert.deepEqual(bundle.passages.map((p) => [p.reference, p.score]), [
    ['Génesis 15:6', 30],
    ['Salmos 143:2', 70],
  ]);
});

test('maxPassages keeps the highest-scoring passages, then canonical order', async () => {
  const fake = fakeFetch(routes());
  const { bundle } = await gatherEvidence(thematicStudy, { theme: THEME, seeds: ['Gá 2:16'], maxPassages: 2 }, context(fake.fetch));
  assert.deepEqual(bundle.passages.map((p) => p.reference), ['Génesis 15:6', 'Salmos 143:2']);
});

test('depth 2 expands from depth-1 targets; already-seen targets keep depth 1', async () => {
  const fake = fakeFetch(routes());
  const { bundle } = await gatherEvidence(thematicStudy, { theme: THEME, seeds: ['Ro 3:28'], depth: 2 }, context(fake.fetch));

  // Rom 3:28 is a seed, so the back-link from Gn 15:6 is excluded. Gal 2:16 is a depth-1 target here
  // (not a seed) and is expanded in turn; Gn 15:6 and Hab 2:4 keep depth 1 and gain the depth-2 scores.
  assert.deepEqual(
    bundle.passages.map((p) => [p.reference, p.score, p.depth, p.linkedFrom]),
    [
      ['Génesis 15:6', 110, 1, ['Romanos 3:28', 'Gálatas 2:16']],
      ['Salmos 106:31', 30, 2, ['Génesis 15:6']],
      ['Salmos 143:2', 70, 2, ['Gálatas 2:16']],
      ['Habacuc 2:4', 85, 1, ['Romanos 3:28', 'Génesis 15:6', 'Gálatas 2:16']],
      ['Romanos 1:17', 50, 2, ['Habacuc 2:4']],
      ['Gálatas 2:16', 50, 1, ['Romanos 3:28']],
    ],
  );
  assert.equal(bundle.passages[4]!.section, 'Pauline Epistles');
});

test('depth 1 does not follow links from the targets', async () => {
  const fake = fakeFetch(routes());
  await gatherEvidence(thematicStudy, { theme: THEME, seeds: ['Ro 3:28'] }, context(fake.fetch));
  assert.ok(!fake.calls.some((url) => url.endsWith('/open-cross-ref/GEN/15.json')));
});

test('canonicalSection maps every book to its section', () => {
  const cases: Array<[string, string]> = [
    ['GEN', 'Law'], ['DEU', 'Law'], ['JOS', 'History'], ['EST', 'History'], ['JOB', 'Wisdom & Poetry'], ['SNG', 'Wisdom & Poetry'],
    ['ISA', 'Major Prophets'], ['DAN', 'Major Prophets'], ['HOS', 'Minor Prophets'], ['MAL', 'Minor Prophets'],
    ['MAT', 'Gospels'], ['JHN', 'Gospels'], ['ACT', 'Acts'], ['ROM', 'Pauline Epistles'], ['PHM', 'Pauline Epistles'],
    ['HEB', 'General Epistles'], ['JUD', 'General Epistles'], ['REV', 'Apocalypse'],
  ];
  for (const [id, section] of cases) assert.equal(canonicalSection(id), section, id);
});
