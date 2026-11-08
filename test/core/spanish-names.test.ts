import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spanishToEnglishName } from '../../src/core/spanish-names.ts';

test('spanishToEnglishName translates names, ignoring case, accents and surrounding whitespace', () => {
  assert.equal(spanishToEnglishName('  José '), 'Joseph');
  assert.equal(spanishToEnglishName('Moisés'), 'Moses');
  assert.equal(spanishToEnglishName('SALOMÓN'), 'Solomon');
  assert.equal(spanishToEnglishName('Monte Sinaí'), 'Sinai');
  assert.equal(spanishToEnglishName('  mar   rojo '), 'Red Sea');
  assert.equal(spanishToEnglishName('Éxodo'), 'The Exodus');
});

test('spanishToEnglishName has no entry for names spelled the same in English', () => {
  const identical = [
    'cain', 'abel', 'abraham', 'isaac', 'jacob', 'esau', 'aaron', 'miriam', 'caleb', 'samuel', 'saul',
    'daniel', 'job', 'david', 'jesus', 'judas', 'simon', 'aquila', 'judea', 'samaria', 'hebron', 'sinai',
    'edom', 'moab', 'persia', 'jordan', 'capernaum', 'patmos',
  ];
  for (const name of identical) {
    assert.equal(spanishToEnglishName(name), undefined, name);
  }
  assert.equal(spanishToEnglishName('David'), undefined);
  assert.equal(spanishToEnglishName('Abraham'), undefined);
});

test('spanishToEnglishName returns undefined for an unknown name', () => {
  assert.equal(spanishToEnglishName('Zzyzx'), undefined);
  assert.equal(spanishToEnglishName(''), undefined);
});
