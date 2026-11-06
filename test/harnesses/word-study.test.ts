import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BibleApiClient } from '../../src/core/client.ts';
import { gatherEvidence, HarnessInputError, parseInput } from '../../src/harness/contract.ts';
import { getProfile } from '../../src/harness/profiles.ts';
import { wordStudy, type WordStudyBundle } from '../../src/harnesses/word-study.ts';
import { chapterFixture, fakeFetch } from '../helpers/fake-fetch.ts';

const word = (pos: number, strongs: string, gloss: string | null, transliteration: string, text = 'τ') => ({
  pos,
  bsbPos: pos,
  language: strongs.startsWith('H') ? 'hebrew' : 'greek',
  text,
  transliteration,
  parsing: 'V-AIA-3S',
  parsingFull: 'Verb, Aorist, Indicative, Active, 3rd Person Singular',
  strongs,
  gloss,
});

const chapter = (number: number, verses: Record<number, ReturnType<typeof word>[]>) => ({
  chapter: { number, content: Object.entries(verses).map(([verse, words]) => ({ verse: Number(verse), words })) },
});

const lexicon = (id: string, definition = 'to love; to value highly') => ({
  entry: {
    id,
    language: id.startsWith('H') ? 'hebrew' : 'greek',
    senses: [{ id, language: 'greek', lemma: 'ἀγαπάω', transliteration: 'agapaō', partOfSpeech: 'verb', gloss: 'to love', definition }],
  },
});

const verses = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

function routes() {
  return {
    '/api/spa_r09/JHN/3.json': chapterFixture('spa_r09', 'JHN', 3, verses('jhn3-', 36)),
    '/api/spa_r09/MAT/5.json': chapterFixture('spa_r09', 'MAT', 5, verses('mat5-', 48)),
    '/api/spa_r09/JHN/14.json': chapterFixture('spa_r09', 'JHN', 14, verses('jhn14-', 31)),
    '/api/d/bsb-interlinear/JHN/3.json': chapter(3, {
      16: [word(1, 'G3779', 'so', 'Houtōs'), word(2, 'G0025', 'loved', 'ēgapēsen', 'ἠγάπησεν'), word(3, 'G2316', 'God', 'ho Theos')],
      35: [word(1, 'G0025', 'loves', 'agapa')],
    }),
    '/api/d/bsb-interlinear/JHN/14.json': chapter(14, { 15: [word(1, 'G0025', 'love', 'agapate')] }),
    '/api/d/bsb-interlinear/MAT/5.json': chapter(5, { 44: [word(1, 'G0025', 'love', 'agapate')] }),
    '/api/d/stepbible-lexicon/lexicon/G0025.json': lexicon('G0025', 'x'.repeat(50)),
    '/api/d/stepbible-lexicon/lexicon/G2316.json': lexicon('G2316'),
    '/api/d/stepbible-lexicon/lexicon/G3779.json': lexicon('G3779'),
  };
}

const paths = (calls: string[]) => calls.map((url) => new URL(url).pathname);

function setup(routeTable: Record<string, unknown> = routes()) {
  const fake = fakeFetch(routeTable);
  return { calls: fake.calls, context: { client: new BibleApiClient({ fetch: fake.fetch }), profile: getProfile(), language: 'es' } };
}

async function gather(raw: unknown, routeTable?: Record<string, unknown>) {
  const { calls, context } = setup(routeTable);
  const { bundle } = await gatherEvidence(wordStudy, raw, context);
  return { bundle: bundle as WordStudyBundle, calls };
}

test('word-study is a harness with its own id', () => {
  assert.equal(wordStudy.id, 'word-study');
  assert.match(wordStudy.summary, /^Use when/);
});

test('input defaults: RV1909, book scope, 30 occurrences, 3000 definition chars', () => {
  const input = parseInput(wordStudy, { reference: 'Jn 3:16', word: 'loved' });
  assert.equal(input.translation, 'spa_r09');
  assert.equal(input.scope, 'book');
  assert.equal(input.maxOccurrences, 30);
  assert.equal(input.definitionCharLimit, 3000);
});

test('input needs a Strong\'s number or a reference with a word', () => {
  assert.throws(() => parseInput(wordStudy, {}), HarnessInputError);
  assert.throws(() => parseInput(wordStudy, { reference: 'Jn 3:16' }), HarnessInputError);
  assert.throws(() => parseInput(wordStudy, { word: 'loved', scope: 'testament' }), /Strong/);
});

test('input: passage and book scope need a reference; a Strong\'s number alone defaults to its testament', () => {
  assert.equal(parseInput(wordStudy, { strongs: 'G25' }).scope, 'testament');
  assert.throws(() => parseInput(wordStudy, { strongs: 'G25', scope: 'book' }), /reference/);
  assert.throws(() => parseInput(wordStudy, { strongs: 'G25', scope: 'passage' }), /reference/);
  assert.equal(parseInput(wordStudy, { strongs: 'G25', scope: 'testament' }).scope, 'testament');
});

test('input rejects a malformed Strong\'s number and an out-of-range maxOccurrences', () => {
  assert.throws(() => parseInput(wordStudy, { strongs: 'amor', scope: 'testament' }), HarnessInputError);
  assert.throws(() => parseInput(wordStudy, { strongs: 'G25', scope: 'testament', maxOccurrences: 101 }), HarnessInputError);
});

test('gather resolves the Strong\'s number from an accent-insensitive transliteration match', async () => {
  const { bundle, calls } = await gather({ reference: 'Jn 3:16', word: 'EGAPESEN' });
  assert.equal(bundle.reference, 'Juan 3:16');
  assert.deepEqual(bundle.targets.map((t) => t.strongs), ['G0025']);
  assert.equal(bundle.targets[0]!.language, 'greek');
  assert.equal(bundle.passage?.verses.length, 1);
  assert.match(bundle.passage!.translation, /spa_r09/);
  // The bundle shows every word of the passage, not just the matched one.
  assert.deepEqual(bundle.interlinear?.[0]?.words.map((w) => w.gloss), ['so', 'loved', 'God']);
  assert.ok(paths(calls).includes('/api/d/stepbible-lexicon/lexicon/G0025.json'));
});

test('gather resolves by gloss and by original text', async () => {
  assert.deepEqual((await gather({ reference: 'Jn 3:16', word: 'Loved' })).bundle.targets.map((t) => t.strongs), ['G0025']);
  assert.deepEqual((await gather({ reference: 'Jn 3:16', word: 'ἠγάπησεν' })).bundle.targets.map((t) => t.strongs), ['G0025']);
});

test('gather keeps every distinct Strong\'s number a word matches', async () => {
  const table = routes();
  table['/api/d/bsb-interlinear/JHN/3.json'] = chapter(3, {
    16: [word(1, 'G0025', 'love', 'agapē'), word(2, 'G0026', 'love', 'agapēn'), word(3, 'G0025', 'love', 'agapē', 'ἀγάπη')],
  });
  const { bundle } = await gather({ reference: 'Jn 3:16', word: 'love', scope: 'passage' }, table);
  assert.deepEqual(bundle.targets.map((t) => t.strongs), ['G0025', 'G0026']);
});

test('gather attaches the lexicon entry with the definition truncated', async () => {
  const { bundle } = await gather({ reference: 'Jn 3:16', word: 'loved', definitionCharLimit: 10 });
  const sense = bundle.targets[0]!.lexicon!.senses[0]!;
  assert.equal(sense.lemma, 'ἀγαπάω');
  assert.equal(sense.transliteration, 'agapaō');
  assert.equal(sense.partOfSpeech, 'verb');
  assert.equal(sense.gloss, 'to love');
  assert.equal(sense.definition, `${'x'.repeat(10)} […truncated]`);
});

test('gather leaves the lexicon out when the dataset has no entry', async () => {
  const table = routes();
  delete (table as Record<string, unknown>)['/api/d/stepbible-lexicon/lexicon/G0025.json'];
  const { bundle } = await gather({ reference: 'Jn 3:16', word: 'loved' }, table);
  assert.equal(bundle.targets[0]!.lexicon, undefined);
});

test('gather in book scope scans only the reference\'s book and attaches verse texts to samples', async () => {
  const { bundle, calls } = await gather({ reference: 'Jn 3:16', word: 'loved', maxOccurrences: 2 });
  const occurrences = bundle.targets[0]!.occurrences;
  assert.equal(occurrences.scope, 'book');
  assert.deepEqual(occurrences.books, ['JHN']);
  assert.equal(occurrences.total, 3);
  assert.deepEqual(occurrences.byBook, { JHN: 3 });
  assert.deepEqual(occurrences.samples.map((s) => [s.reference, s.verseText]), [
    ['Juan 3:16', 'jhn3-16'],
    ['Juan 3:35', 'jhn3-35'],
  ]);
  const interlinearCalls = paths(calls).filter((p) => p.includes('/bsb-interlinear/'));
  assert.ok(interlinearCalls.length >= 21);
  assert.ok(interlinearCalls.every((p) => p.startsWith('/api/d/bsb-interlinear/JHN/')));
});

test('gather in passage scope counts only the passage\'s verses', async () => {
  const { bundle } = await gather({ reference: 'Jn 3:16', word: 'loved', scope: 'passage' });
  const occurrences = bundle.targets[0]!.occurrences;
  assert.equal(occurrences.scope, 'passage');
  assert.equal(occurrences.total, 1);
});

test('gather with a word the passage lacks names it and lists the glosses', async () => {
  const { context } = setup();
  await assert.rejects(
    gatherEvidence(wordStudy, { reference: 'Jn 3:16', word: 'dynamite' }, context),
    (error: Error) => /dynamite/.test(error.message) && /loved/.test(error.message) && /God/.test(error.message),
  );
});

test('gather with only a Strong\'s number and testament scope requests just that testament', async () => {
  const { bundle, calls } = await gather({ strongs: 'G25', scope: 'testament', maxOccurrences: 1 });
  assert.equal(bundle.reference, undefined);
  assert.equal(bundle.passage, undefined);
  assert.equal(bundle.interlinear, undefined);
  const target = bundle.targets[0]!;
  assert.equal(target.strongs, 'G0025');
  assert.equal(target.occurrences.books.length, 27);
  assert.deepEqual(target.occurrences.books.slice(0, 2), ['MAT', 'MRK']);
  assert.deepEqual(target.occurrences.byBook, { MAT: 1, JHN: 3 });
  assert.equal(target.occurrences.samples[0]!.verseText, 'mat5-44');
  const requested = paths(calls).filter((p) => p.includes('/bsb-interlinear/'));
  assert.equal(requested.length, 260);
  assert.ok(requested.every((p) => !p.includes('/GEN/') && !p.includes('/PSA/')));
});

test('gather with an Old Testament Strong\'s number scans only the Old Testament', async () => {
  const { bundle, calls } = await gather({ strongs: 'H2617', scope: 'testament' });
  assert.equal(bundle.targets[0]!.language, 'hebrew');
  assert.equal(bundle.targets[0]!.occurrences.books.length, 39);
  assert.equal(bundle.targets[0]!.occurrences.total, 0);
  assert.ok(paths(calls).every((p) => !p.includes('/MAT/') && !p.includes('/JHN/')));
});

test('sources record the datasets and their licenses', async () => {
  const { bundle } = await gather({ reference: 'Jn 3:16', word: 'loved' });
  assert.ok(bundle.sources.some((s) => s === 'BSB interlinear (public domain)'));
  assert.ok(bundle.sources.some((s) => s === 'STEPBible Brief Lexicons, CC BY 4.0, STEPBible.org / Tyndale House'));
  assert.ok(bundle.sources.some((s) => /spa_r09/.test(s)));
});

test('registry exposes word-study', async () => {
  const { getHarness } = await import('../../src/harnesses/index.ts');
  assert.equal(getHarness('word-study'), wordStudy);
});
