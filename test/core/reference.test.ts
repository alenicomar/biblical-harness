import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOOKS, findBook } from '../../src/core/books.ts';
import {
  formatReference,
  parseReference,
  parseReferences,
  ReferenceParseError,
} from '../../src/core/reference.ts';

test('catalog holds the 66-book Protestant canon in canonical order', () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(BOOKS[0]?.id, 'GEN');
  assert.equal(BOOKS[38]?.id, 'MAL');
  assert.equal(BOOKS[39]?.id, 'MAT');
  assert.equal(BOOKS[65]?.id, 'REV');
  assert.equal(BOOKS.filter((b) => b.testament === 'OT').length, 39);
  assert.equal(BOOKS.reduce((sum, b) => sum + b.chapters, 0), 1189);
});

test('findBook resolves Spanish, English, abbreviated and ordinal names', () => {
  const cases: Array<[string, string]> = [
    ['Génesis', 'GEN'],
    ['genesis', 'GEN'],
    ['Gn', 'GEN'],
    ['San Juan', 'JHN'],
    ['Jn', 'JHN'],
    ['1 Co', '1CO'],
    ['1Co', '1CO'],
    ['1 Cor.', '1CO'],
    ['Primera de Corintios', '1CO'],
    ['II Timoteo', '2TI'],
    ['2da Pedro', '2PE'],
    ['Sal', 'PSA'],
    ['Salmo', 'PSA'],
    ['Cantares', 'SNG'],
    ['Apocalipsis', 'REV'],
    ['Revelation', 'REV'],
    ['Stg', 'JAS'],
    ['Flp', 'PHP'],
    ['Flm', 'PHM'],
    ['JHN', 'JHN'],
  ];
  for (const [input, id] of cases) {
    assert.equal(findBook(input)?.id, id, input);
  }
  assert.equal(findBook('Tobías'), undefined);
});

test('parses verse, verse range, chapter, chapter range and cross-chapter range', () => {
  assert.deepEqual(parseReference('Juan 3:16'), {
    book: 'JHN', startChapter: 3, startVerse: 16, endChapter: 3, endVerse: 16,
  });
  assert.deepEqual(parseReference('Jn 3:16-18'), {
    book: 'JHN', startChapter: 3, startVerse: 16, endChapter: 3, endVerse: 18,
  });
  assert.deepEqual(parseReference('1 Co 13'), { book: '1CO', startChapter: 13, endChapter: 13 });
  assert.deepEqual(parseReference('Sal 23-24'), { book: 'PSA', startChapter: 23, endChapter: 24 });
  assert.deepEqual(parseReference('Gn 1:1-2:3'), {
    book: 'GEN', startChapter: 1, startVerse: 1, endChapter: 2, endVerse: 3,
  });
});

test('accepts dot, comma and en dash separators', () => {
  const expected = { book: 'ROM', startChapter: 8, startVerse: 28, endChapter: 8, endVerse: 39 };
  assert.deepEqual(parseReference('Ro 8.28-39'), expected);
  assert.deepEqual(parseReference('Romanos 8,28–39'), expected);
});

test('a bare number in a one-chapter book is a verse', () => {
  assert.deepEqual(parseReference('Judas 3'), {
    book: 'JUD', startChapter: 1, startVerse: 3, endChapter: 1, endVerse: 3,
  });
  assert.deepEqual(parseReference('Flm 4-7'), {
    book: 'PHM', startChapter: 1, startVerse: 4, endChapter: 1, endVerse: 7,
  });
});

test('rejects unknown books, out-of-range chapters and inverted ranges', () => {
  assert.throws(() => parseReference('Tobías 1:1'), ReferenceParseError);
  assert.throws(() => parseReference('Juan 22:1'), /chapter 22 is out of range for JHN \(1-21\)/);
  assert.throws(() => parseReference('Juan 3:18-16'), /ends before it starts/);
  assert.throws(() => parseReference('Juan'), ReferenceParseError);
  assert.throws(() => parseReference(''), ReferenceParseError);
});

test('parseReferences splits on semicolons', () => {
  const refs = parseReferences('Jn 3:16; 1 Jn 4:8');
  assert.equal(refs.length, 2);
  assert.equal(refs[1]?.book, '1JN');
});

test('formatReference renders Spanish and English names', () => {
  assert.equal(formatReference(parseReference('jn 3:16-18')), 'Juan 3:16-18');
  assert.equal(formatReference(parseReference('Gn 1:1-2:3')), 'Génesis 1:1-2:3');
  assert.equal(formatReference(parseReference('Sal 23')), 'Salmos 23');
  assert.equal(formatReference(parseReference('Sal 23-24'), 'en'), 'Psalms 23-24');
  assert.equal(formatReference(parseReference('Judas 3')), 'Judas 3');
});
