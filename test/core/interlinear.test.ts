import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BibleApiClient } from '../../src/core/client.ts';
import { findOccurrences, getInterlinear, getLexiconEntry, normalizeStrongs } from '../../src/core/interlinear.ts';
import { parseReference } from '../../src/core/reference.ts';
import { fakeFetch } from '../helpers/fake-fetch.ts';

const word = (strongs: string, gloss: string | null, transliteration = gloss ?? '', pos = 1) => ({
  pos,
  bsbPos: pos,
  language: strongs.startsWith('H') ? 'hebrew' : 'greek',
  text: `τ${pos}`,
  transliteration,
  parsing: 'V-AIA-3S',
  parsingFull: 'Verb, Aorist, Indicative, Active, 3rd Person Singular',
  strongs,
  gloss,
});

const chapter = (number: number, verses: Record<number, ReturnType<typeof word>[]>) => ({
  chapter: {
    number,
    content: Object.entries(verses).map(([verse, words]) => ({ verse: Number(verse), words })),
  },
});

const clientFor = (routes: Record<string, unknown>) => {
  const fake = fakeFetch(routes);
  return { client: new BibleApiClient({ fetch: fake.fetch }), calls: fake.calls };
};

const paths = (calls: string[]) => calls.map((url) => new URL(url).pathname);

test('normalizeStrongs pads and uppercases valid numbers', () => {
  assert.equal(normalizeStrongs('G25'), 'G0025');
  assert.equal(normalizeStrongs('g0025'), 'G0025');
  assert.equal(normalizeStrongs('H157'), 'H0157');
  assert.equal(normalizeStrongs('H0157'), 'H0157');
  assert.equal(normalizeStrongs(' h2617 '), 'H2617');
});

test('normalizeStrongs keeps an uppercase letter suffix', () => {
  assert.equal(normalizeStrongs('G2316G'), 'G2316G');
  assert.equal(normalizeStrongs('g2316g'), 'G2316G');
  assert.equal(normalizeStrongs('H9001'), 'H9001');
});

test('normalizeStrongs rejects anything else', () => {
  for (const bad of ['', 'X25', '25', 'G', 'G0', 'G12345', 'G25-26', 'G2316GG', 'amor']) {
    assert.throws(() => normalizeStrongs(bad), /Strong/, bad);
  }
});

test('getInterlinear returns only the verses of the passage, in order', async () => {
  const { client, calls } = clientFor({
    '/api/d/bsb-interlinear/JHN/3.json': chapter(3, {
      15: [word('G2222', 'life')],
      16: [word('G0025', 'loved'), word('G2316', 'God', 'Theos', 2)],
      17: [word('G0649', 'sent')],
      18: [word('G4100', 'believes')],
    }),
  });
  const verses = await getInterlinear(client, parseReference('Jn 3:16-17'));
  assert.deepEqual(
    verses.map((v) => [v.chapter, v.verse, v.words.map((w) => w.gloss)]),
    [
      [3, 16, ['loved', 'God']],
      [3, 17, ['sent']],
    ],
  );
  assert.deepEqual(paths(calls), ['/api/d/bsb-interlinear/JHN/3.json']);
});

test('getInterlinear spans chapters and skips a chapter the dataset lacks', async () => {
  const { client } = clientFor({
    '/api/d/bsb-interlinear/JHN/3.json': chapter(3, { 36: [word('G2222', 'life')] }),
    '/api/d/bsb-interlinear/JHN/5.json': chapter(5, { 1: [word('G1859', 'feast')] }),
  });
  const verses = await getInterlinear(client, parseReference('Jn 3:36-5:1'));
  assert.deepEqual(verses.map((v) => `${v.chapter}:${v.verse}`), ['3:36', '5:1']);
});

test('getLexiconEntry returns the entry by padded id', async () => {
  const entry = { id: 'G0025', language: 'greek', senses: [{ id: 'G0025', language: 'greek', lemma: 'ἀγαπάω', transliteration: 'agapaō', partOfSpeech: 'verb', gloss: 'to love', definition: 'to love' }] };
  const { client, calls } = clientFor({ '/api/d/stepbible-lexicon/lexicon/G0025.json': { entry } });
  assert.deepEqual(await getLexiconEntry(client, 'G0025'), entry);
  assert.deepEqual(paths(calls), ['/api/d/stepbible-lexicon/lexicon/G0025.json']);
});

test('getLexiconEntry falls back to the unsuffixed id and returns undefined when missing', async () => {
  const entry = { id: 'G2316', language: 'greek', senses: [] };
  const { client, calls } = clientFor({ '/api/d/stepbible-lexicon/lexicon/G2316.json': { entry } });
  assert.deepEqual(await getLexiconEntry(client, 'G2316G'), entry);
  assert.deepEqual(paths(calls), ['/api/d/stepbible-lexicon/lexicon/G2316G.json', '/api/d/stepbible-lexicon/lexicon/G2316.json']);
  assert.equal(await getLexiconEntry(client, 'G9999'), undefined);
});

function occurrenceRoutes() {
  return {
    '/api/d/bsb-interlinear/JHN/3.json': chapter(3, {
      16: [word('G0025', 'loved', 'ēgapēsen'), word('G2316', 'God', 'Theos', 2)],
      35: [word('G0025', 'loves', 'agapa')],
    }),
    '/api/d/bsb-interlinear/JHN/14.json': chapter(14, {
      15: [word('G0025', 'love', 'agapate')],
      21: [word('G0025', 'loves', 'agapōn'), word('G0025', 'loves', 'agapōn', 2)],
    }),
    '/api/d/bsb-interlinear/1JN/4.json': chapter(4, { 8: [word('G0025G', 'love', 'agapōn')], 9: [word('G2316', 'God')] }),
  };
}

test('findOccurrences counts words, groups by book and gloss and caps the samples', async () => {
  const { client, calls } = clientFor(occurrenceRoutes());
  const result = await findOccurrences(client, 'G25', ['JHN', '1JN'], { max: 3 });
  assert.equal(result.total, 6);
  assert.deepEqual(result.byBook, { JHN: 5, '1JN': 1 });
  assert.deepEqual(result.glosses, [
    { gloss: 'loves', count: 3 },
    { gloss: 'love', count: 2 },
    { gloss: 'loved', count: 1 },
  ]);
  assert.equal(result.samples.length, 3);
  assert.deepEqual(
    result.samples.map((s) => s.reference),
    ['Juan 3:16', 'Juan 3:35', 'Juan 14:15'],
  );
  assert.deepEqual(result.samples[0], {
    ref: { book: 'JHN', startChapter: 3, startVerse: 16, endChapter: 3, endVerse: 16 },
    reference: 'Juan 3:16',
    text: 'τ1',
    transliteration: 'ēgapēsen',
    parsing: 'V-AIA-3S',
    gloss: 'loved',
  });
  // Only the requested books are scanned: 21 chapters of John plus 5 of 1 John.
  const scanned = paths(calls);
  assert.equal(scanned.length, 26);
  assert.ok(scanned.every((p) => p.startsWith('/api/d/bsb-interlinear/JHN/') || p.startsWith('/api/d/bsb-interlinear/1JN/')));
});

test('findOccurrences skips chapters the dataset does not have', async () => {
  const { client } = clientFor({ '/api/d/bsb-interlinear/JHN/3.json': occurrenceRoutes()['/api/d/bsb-interlinear/JHN/3.json'] });
  const result = await findOccurrences(client, 'G0025', ['JHN'], { max: 10 });
  assert.equal(result.total, 2);
  assert.deepEqual(result.byBook, { JHN: 2 });
});

test('findOccurrences counts nothing for a number that never occurs', async () => {
  const { client } = clientFor(occurrenceRoutes());
  const result = await findOccurrences(client, 'G0001', ['JHN'], { max: 5 });
  assert.deepEqual(result, { total: 0, byBook: {}, glosses: [], samples: [] });
});

test('findOccurrences restricted to a passage counts only its verses and chapters', async () => {
  const { client, calls } = clientFor(occurrenceRoutes());
  const result = await findOccurrences(client, 'G0025', ['JHN'], { max: 10, within: parseReference('Jn 14:15-20') });
  assert.equal(result.total, 1);
  assert.deepEqual(result.samples.map((s) => s.reference), ['Juan 14:15']);
  assert.deepEqual(paths(calls), ['/api/d/bsb-interlinear/JHN/14.json']);
});
