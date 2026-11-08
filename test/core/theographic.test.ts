import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BibleApiClient } from '../../src/core/client.ts';
import { parseReference } from '../../src/core/reference.ts';
import {
  findHistoryGlobePlace,
  formatYear,
  getEvent,
  getGroup,
  getPassageEntities,
  getPerson,
  getPlace,
  parseYear,
  searchEntities,
} from '../../src/core/theographic.ts';
import { fakeFetch } from '../helpers/fake-fetch.ts';

const client = (routes: Record<string, unknown>) => {
  const fake = fakeFetch(routes);
  return { api: new BibleApiClient({ fetch: fake.fetch }), calls: fake.calls };
};

test('parseYear reads plain, padded, negative and dated years', () => {
  assert.equal(parseYear('0046'), 46);
  assert.equal(parseYear('29'), 29);
  assert.equal(parseYear('-1085'), -1085);
  assert.equal(parseYear('-01085'), -1085);
  assert.equal(parseYear('0047-05-01'), 47);
  assert.equal(parseYear('-1919-03'), -1919);
  assert.equal(parseYear(' 33 '), 33);
});

test('parseYear returns undefined for missing or invalid input', () => {
  assert.equal(parseYear(undefined), undefined);
  assert.equal(parseYear(''), undefined);
  assert.equal(parseYear('circa 30'), undefined);
  assert.equal(parseYear('1.5'), undefined);
  assert.equal(parseYear('--5'), undefined);
});

test('formatYear writes Spanish A.D./B.C. style', () => {
  assert.equal(formatYear(46), '46 d.C.');
  assert.equal(formatYear(-1085), '1085 a.C.');
  assert.equal(formatYear(1), '1 d.C.');
  assert.equal(formatYear(-1), '1 a.C.');
});

const actChapter = (number: number, body: { people?: unknown[]; places?: unknown[]; events?: unknown[] }) => ({
  chapter: { number, people: body.people ?? [], places: body.places ?? [], events: body.events ?? [] },
});

test('getPassageEntities keeps entities with verses in the passage, across chapters, deduped by id', async () => {
  const { api, calls } = client({
    '/api/d/theographic/ACT/15.json': actChapter(15, {
      people: [
        { id: 'paul_2479', name: 'Paul', verses: [2, 22, 35, 40] },
        { id: 'barnabas_300', name: 'Barnabas', verses: [2, 12] },
        { id: 'moses_1', name: 'Moses', verses: [1, 21] },
      ],
      places: [{ id: 'antioch_1', name: 'Antioch', featureType: 'City', latitude: 36.2, longitude: 36.1, verses: [22, 23] }],
      events: [{ id: 'council_1', name: 'Jerusalem Council', startDate: '0049', verses: [1, 2, 3, 30] }],
    }),
    '/api/d/theographic/ACT/16.json': actChapter(16, {
      people: [
        { id: 'paul_2479', name: 'Paul', verses: [1, 3, 9, 40] },
        { id: 'timotheus_2863', name: 'Timotheus', verses: [1, 2] },
      ],
      events: [{ id: 'council_1', name: 'Jerusalem Council', startDate: '0049', verses: [4, 5] }],
    }),
  });

  const found = await getPassageEntities(api, parseReference('Hch 15:22-16:3'));

  assert.deepEqual(
    found.people.map((p) => [p.id, p.verses]),
    [
      [
        'paul_2479',
        [
          { chapter: 15, verse: 22 },
          { chapter: 15, verse: 35 },
          { chapter: 15, verse: 40 },
          { chapter: 16, verse: 1 },
          { chapter: 16, verse: 3 },
        ],
      ],
      [
        'timotheus_2863',
        [
          { chapter: 16, verse: 1 },
          { chapter: 16, verse: 2 },
        ],
      ],
    ],
  );
  assert.deepEqual(found.places.map((p) => [p.id, p.latitude, p.featureType]), [['antioch_1', 36.2, 'City']]);
  // The council is listed in both chapters but only 15:30 lies inside the passage.
  assert.deepEqual(found.events.map((e) => [e.id, e.verses]), [['council_1', [{ chapter: 15, verse: 30 }]]]);
  assert.deepEqual(calls.sort(), [
    'https://bible.helloao.org/api/d/theographic/ACT/15.json',
    'https://bible.helloao.org/api/d/theographic/ACT/16.json',
  ]);
});

test('getPassageEntities merges an entity listed in two chapters and tolerates uncovered chapters', async () => {
  const { api } = client({
    '/api/d/theographic/ACT/15.json': actChapter(15, { events: [{ id: 'council_1', name: 'Council', startDate: '0049', verses: [30, 31] }] }),
    '/api/d/theographic/ACT/16.json': actChapter(16, { events: [{ id: 'council_1', name: 'Council', startDate: '0049', verses: [4] }] }),
  });
  const found = await getPassageEntities(api, parseReference('Hch 15:30-17:1'));
  assert.deepEqual(found.events.map((e) => [e.id, e.startDate, e.verses]), [
    ['council_1', '0049', [{ chapter: 15, verse: 30 }, { chapter: 15, verse: 31 }, { chapter: 16, verse: 4 }]],
  ]);
});

test('getPerson, getPlace, getEvent and getGroup read the entity file', async () => {
  const { api, calls } = client({
    '/api/d/theographic/people/paul_2479.json': { person: { id: 'paul_2479', name: 'Paul' } },
    '/api/d/theographic/places/philippi_942.json': { place: { id: 'philippi_942', name: 'Philippi' } },
    '/api/d/theographic/events/call_1.json': { event: { id: 'call_1', name: 'Call' } },
    '/api/d/theographic/groups/apostles.json': { group: { id: 'apostles', name: 'Apostles' } },
  });
  assert.equal((await getPerson(api, 'paul_2479')).name, 'Paul');
  assert.equal((await getPlace(api, 'philippi_942')).name, 'Philippi');
  assert.equal((await getEvent(api, 'call_1')).name, 'Call');
  assert.equal((await getGroup(api, 'apostles')).name, 'Apostles');
  assert.equal(calls.length, 4);
});

const peopleIndex = {
  people: [
    { id: 'david_1', name: 'David', numberOfReferences: 1100 },
    { id: 'david_2', name: 'David', numberOfReferences: 3 },
    { id: 'davidson_3', name: 'Davidson', numberOfReferences: 500 },
    { id: 'adavid_4', name: 'Bar-David', numberOfReferences: 900 },
    { id: 'jonathan_5', name: 'Jonathan', alsoCalled: ['Davidic prince'], numberOfReferences: 120 },
    { id: 'solomon_6', name: 'Solomon', alsoCalled: ['Jedidiah'], numberOfReferences: 300 },
    { id: 'jose_7', name: 'José', numberOfReferences: 10 },
  ],
};

test('searchEntities ranks exact, then prefix, then substring, ties by numberOfReferences', async () => {
  const { api } = client({ '/api/d/theographic/people.json': peopleIndex });
  const found = await searchEntities(api, 'person', 'david', { limit: 10 });
  assert.deepEqual(found.map((p) => p.id), ['david_1', 'david_2', 'davidson_3', 'jonathan_5', 'adavid_4']);
});

test('searchEntities is accent-insensitive and honours the limit', async () => {
  const { api } = client({ '/api/d/theographic/people.json': peopleIndex });
  assert.deepEqual((await searchEntities(api, 'person', '  JOSE ')).map((p) => p.id), ['jose_7']);
  assert.deepEqual((await searchEntities(api, 'person', 'david', { limit: 2 })).map((p) => p.id), ['david_1', 'david_2']);
  assert.deepEqual(await searchEntities(api, 'person', 'nobody'), []);
});

test('searchEntities matches alsoCalled for people when the index provides it', async () => {
  const { api } = client({ '/api/d/theographic/people.json': peopleIndex });
  assert.deepEqual((await searchEntities(api, 'person', 'Jedidiah')).map((p) => p.id), ['solomon_6']);
});

const josephIndex = {
  people: [
    { id: 'joses_1', name: 'Joses', numberOfReferences: 900 },
    { id: 'josephus_2', name: 'Josephus', numberOfReferences: 800 },
    { id: 'joseph_3', name: 'Joseph', numberOfReferences: 200 },
  ],
};

test('searchEntities uses the English spelling of a Spanish name when nothing matches directly', async () => {
  const { api } = client({
    '/api/d/theographic/places.json': { places: [{ id: 'bethlehem_1', name: 'Bethlehem', numberOfReferences: 40 }] },
  });
  assert.deepEqual((await searchEntities(api, 'place', 'Belén')).map((p) => p.id), ['bethlehem_1']);
});

test('searchEntities ranks the translated match ahead of a partial direct hit', async () => {
  const { api } = client({ '/api/d/theographic/people.json': josephIndex });
  // "jose" only prefixes Joses (the best-attested hit); the translation "Joseph" matches Joseph, then Josephus.
  assert.deepEqual((await searchEntities(api, 'person', 'José')).map((p) => p.id), ['joseph_3', 'josephus_2', 'joses_1']);
  assert.deepEqual((await searchEntities(api, 'person', 'José', { limit: 1 })).map((p) => p.id), ['joseph_3']);
});

test('searchEntities keeps an exact direct hit ahead of the translated match', async () => {
  const { api } = client({
    '/api/d/theographic/people.json': { people: [...josephIndex.people, { id: 'jose_4', name: 'José', numberOfReferences: 1 }] },
  });
  assert.deepEqual((await searchEntities(api, 'person', 'José')).map((p) => p.id), ['jose_4', 'joseph_3', 'josephus_2', 'joses_1']);
});

test('searchEntities returns each entity once when the direct and translated matches overlap', async () => {
  const { api } = client({ '/api/d/theographic/people.json': peopleIndex });
  // "Davíd" and its translation "David" match the same people.
  assert.deepEqual((await searchEntities(api, 'person', 'Davíd')).map((p) => p.id), ['david_1', 'david_2', 'davidson_3', 'jonathan_5', 'adavid_4']);
});

test('searchEntities returns [] for a name with no translation and no match', async () => {
  const { api } = client({
    '/api/d/theographic/places.json': { places: [{ id: 'bethlehem_1', name: 'Bethlehem', numberOfReferences: 40 }] },
  });
  assert.deepEqual(await searchEntities(api, 'place', 'Atlantida'), []);
});

test('searchEntities reads the index of each kind', async () => {
  const { api, calls } = client({
    '/api/d/theographic/places.json': { places: [{ id: 'bethlehem_1', name: 'Bethlehem', numberOfReferences: 40 }] },
    '/api/d/theographic/events.json': { events: [{ id: 'exodus_1', name: 'The Exodus', numberOfReferences: 20 }] },
    '/api/d/theographic/groups.json': { groups: [{ id: 'apostles', name: 'Apostles', numberOfMembers: 12 }] },
  });
  assert.deepEqual((await searchEntities(api, 'place', 'bethlehem')).map((p) => p.id), ['bethlehem_1']);
  assert.deepEqual((await searchEntities(api, 'event', 'exodus')).map((p) => p.id), ['exodus_1']);
  assert.deepEqual((await searchEntities(api, 'group', 'apostle')).map((p) => p.id), ['apostles']);
  assert.equal(calls.length, 3);
});

const globeIndex = {
  places: [
    { id: 'a1', name: 'Bethlehem', featureType: 'City', latitude: 31.7, longitude: 35.2, numberOfReferences: 40 },
    { id: 'a2', name: 'Bethlehem', featureType: 'City', latitude: 32.7, longitude: 35.2, numberOfReferences: 2 },
    { id: 'a3', name: 'Philippi', featureType: 'City', latitude: 41.0, longitude: 24.3, numberOfReferences: 4 },
  ],
};

test('findHistoryGlobePlace matches by normalized name and the nearest coordinates among namesakes', async () => {
  const { api } = client({ '/api/d/history-globe/places.json': globeIndex });
  assert.equal((await findHistoryGlobePlace(api, 'PHILIPPI'))?.id, 'a3');
  assert.equal((await findHistoryGlobePlace(api, 'Bethlehem', 32.6, 35.2))?.id, 'a2');
  assert.equal((await findHistoryGlobePlace(api, 'Bethlehem', 31.7, 35.2))?.id, 'a1');
  // Without coordinates the best-attested namesake wins.
  assert.equal((await findHistoryGlobePlace(api, 'Bethlehem'))?.id, 'a1');
  assert.equal(await findHistoryGlobePlace(api, 'Atlantis'), undefined);
});
