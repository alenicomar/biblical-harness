import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BibleApiClient } from '../../src/core/client.ts';
import { parseReference } from '../../src/core/reference.ts';
import { getCommentary, getCrossReferences, getPassage } from '../../src/core/passage.ts';
import { verseText } from '../../src/core/text.ts';
import { chapterFixture, fakeFetch } from '../helpers/fake-fetch.ts';

test('verseText joins strings and formatted text, skipping footnote markers and headings', () => {
  const text = verseText([
    'Respondió Jesús:',
    { text: 'De cierto te digo', wordsOfJesus: true },
    { noteId: 4 },
    { heading: 'Inline heading' },
    { lineBreak: true },
    { text: 'que es necesario.', poem: 1 },
  ]);
  assert.equal(text, 'Respondió Jesús: De cierto te digo que es necesario.');
});

test('getPassage keeps only the verses inside a cross-chapter range, with headings', async () => {
  const fake = fakeFetch({
    '/api/spa_r09/GEN/1.json': chapterFixture('spa_r09', 'GEN', 1, ['g1v1', 'g1v2', 'g1v3'], 'La creación'),
    '/api/spa_r09/GEN/2.json': chapterFixture('spa_r09', 'GEN', 2, ['g2v1', 'g2v2', 'g2v3']),
  });
  const client = new BibleApiClient({ fetch: fake.fetch });

  const passage = await getPassage(client, 'spa_r09', parseReference('Gn 1:3-2:2'));

  assert.equal(passage.reference, 'Génesis 1:3-2:2');
  assert.equal(passage.translation.id, 'spa_r09');
  assert.deepEqual(passage.verses, [
    { chapter: 1, verse: 3, text: 'g1v3' },
    { chapter: 2, verse: 1, text: 'g2v1' },
    { chapter: 2, verse: 2, text: 'g2v2' },
  ]);
  assert.deepEqual(passage.headings, []);

  const whole = await getPassage(client, 'spa_r09', parseReference('Gn 1'));
  assert.equal(whole.verses.length, 3);
  assert.deepEqual(whole.headings, [{ chapter: 1, beforeVerse: 1, text: 'La creación' }]);
});

test('getCommentary keeps notes in range and the chapter introduction; undefined when absent', async () => {
  const fake = fakeFetch({
    '/api/c/matthew-henry/JHN/3.json': {
      commentary: { id: 'matthew-henry', name: 'Matthew Henry Bible Commentary' },
      chapter: {
        number: 3,
        introduction: 'In this chapter...',
        content: [
          { type: 'verse', number: 1, content: ['On v1'] },
          { type: 'verse', number: 16, content: ['On v16', 'more'] },
        ],
      },
    },
  });
  const client = new BibleApiClient({ fetch: fake.fetch });

  const notes = await getCommentary(client, 'matthew-henry', parseReference('Jn 3:16-18'));
  assert.deepEqual(notes, {
    commentary: { id: 'matthew-henry', name: 'Matthew Henry Bible Commentary' },
    introductions: [{ chapter: 3, text: 'In this chapter...' }],
    notes: [{ chapter: 3, verse: 16, text: 'On v16\nmore' }],
  });
  assert.equal(await getCommentary(client, 'keil-delitzsch', parseReference('Jn 3:16')), undefined);
});

test('getCrossReferences flattens, filters by score, sorts and limits per verse', async () => {
  const fake = fakeFetch({
    '/api/d/open-cross-ref/JHN/3.json': {
      chapter: {
        number: 3,
        content: [
          { verse: 15, references: [{ book: 'NUM', chapter: 21, verse: 9, score: 50 }] },
          {
            verse: 16,
            references: [
              { book: 'ROM', chapter: 5, verse: 8, score: 80 },
              { book: '1JN', chapter: 4, verse: 9, endVerse: 10, score: 120 },
              { book: 'GEN', chapter: 22, verse: 2, score: 2 },
              { book: 'TOB', chapter: 1, verse: 1, score: 99 },
            ],
          },
        ],
      },
    },
  });
  const client = new BibleApiClient({ fetch: fake.fetch });

  const refs = await getCrossReferences(client, parseReference('Jn 3:16'), { minScore: 5, limitPerVerse: 5 });

  assert.deepEqual(refs, [
    {
      from: { chapter: 3, verse: 16 },
      to: { book: '1JN', startChapter: 4, startVerse: 9, endChapter: 4, endVerse: 10 },
      reference: '1 Juan 4:9-10',
      score: 120,
    },
    {
      from: { chapter: 3, verse: 16 },
      to: { book: 'ROM', startChapter: 5, startVerse: 8, endChapter: 5, endVerse: 8 },
      reference: 'Romanos 5:8',
      score: 80,
    },
  ]);
  const limited = await getCrossReferences(client, parseReference('Jn 3:15-16'), { limitPerVerse: 1 });
  assert.deepEqual(limited.map((r) => r.reference), ['Números 21:9', '1 Juan 4:9-10']);
});
