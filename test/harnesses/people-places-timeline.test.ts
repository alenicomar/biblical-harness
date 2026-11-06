import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BibleApiClient } from '../../src/core/client.ts';
import { gatherEvidence, HarnessInputError, parseInput } from '../../src/harness/contract.ts';
import { getProfile } from '../../src/harness/profiles.ts';
import { peoplePlacesTimeline } from '../../src/harnesses/people-places-timeline.ts';
import { chapterFixture, fakeFetch } from '../helpers/fake-fetch.ts';

const verses = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

const link = (type: string, id: string, name: string) => ({ id, type, name, apiLink: `/api/d/theographic/${type}/${id}.json` });

const THEO = '/api/d/theographic';
const GLOBE = '/api/d/history-globe';

function routes() {
  return {
    '/api/spa_r09/ACT/16.json': chapterFixture('spa_r09', 'ACT', 16, verses('act', 15)),
    [`${THEO}/ACT/16.json`]: {
      chapter: {
        number: 16,
        people: [
          { id: 'paul_2479', name: 'Paul', gender: 'Male', verses: [3, 9, 14] },
          { id: 'timotheus_2863', name: 'Timotheus', gender: 'Male', verses: [1, 2] },
          { id: 'moses_1', name: 'Moses', verses: [30] }, // outside the passage
        ],
        places: [
          { id: 'lystra_742', name: 'Lystra', featureType: 'City', latitude: 37.6, longitude: 32.3, verses: [1, 2] },
          { id: 'derbe_330', name: 'Derbe', featureType: 'City', latitude: 37.3, longitude: 33.4, verses: [1] },
        ],
        events: [
          { id: 'timothy-joins_349', name: 'Timothy Joins Paul and Silas', startDate: '0047-05-01', verses: [1, 2, 3] },
          { id: 'second-journey_345', name: 'Second Missionary Journey', startDate: '0046', verses: [1, 2, 3, 4] },
          { id: 'circumcision_9', name: 'Timothy Circumcised', verses: [3] },
        ],
      },
    },
    [`${THEO}/people/paul_2479.json`]: {
      person: {
        id: 'paul_2479',
        name: 'Paul',
        alsoCalled: ['Saul'],
        gender: 'Male',
        description: ['A'.repeat(50)],
        birthYear: 5,
        deathYear: 67,
        birthPlace: link('places', 'tarsus_1', 'Tarsus'),
        children: [],
        memberOf: [link('groups', 'apostles', 'Apostles')],
        references: [{ book: 'ACT', chapter: 9, verse: 1 }],
      },
    },
    [`${THEO}/people/timotheus_2863.json`]: {
      person: {
        id: 'timotheus_2863',
        name: 'Timotheus',
        mother: [link('people', 'eunice_1', 'Eunice')],
        father: [link('people', 'greek_1', 'A Greek')],
        description: ['Timothy, son of a Jewish mother and a Greek father.'],
      },
    },
    [`${THEO}/places/lystra_742.json`]: {
      place: {
        id: 'lystra_742',
        name: 'Lystra',
        kjvName: 'Lystra',
        esvName: 'Lystra',
        featureType: 'City',
        latitude: 37.6,
        longitude: 32.3,
        description: ['A city of Lycaonia.'],
        references: [{ book: 'ACT', chapter: 14, verse: 6 }],
      },
    },
    [`${THEO}/places/derbe_330.json`]: {
      place: { id: 'derbe_330', name: 'Derbe', featureType: 'City', latitude: 37.3, longitude: 33.4, references: [] },
    },
    [`${THEO}/events/timothy-joins_349.json`]: {
      event: {
        id: 'timothy-joins_349',
        name: 'Timothy Joins Paul and Silas',
        startDate: '0047-05-01',
        duration: '1D',
        participants: [link('people', 'paul_2479', 'Paul'), link('people', 'timotheus_2863', 'Timotheus')],
        locations: [link('places', 'lystra_742', 'Lystra')],
        predecessor: link('events', 'second-journey_345', 'Second Missionary Journey'),
        references: [{ book: 'ACT', chapter: 16, verse: 1, endVerse: 5 }],
      },
    },
    [`${THEO}/events/second-journey_345.json`]: {
      event: { id: 'second-journey_345', name: 'Second Missionary Journey', startDate: '0046', references: [{ book: 'ACT', chapter: 15, verse: 36, endVerse: 18 }] },
    },
    [`${THEO}/events/circumcision_9.json`]: {
      event: { id: 'circumcision_9', name: 'Timothy Circumcised', references: [{ book: 'ACT', chapter: 16, verse: 3 }] },
    },
    [`${GLOBE}/places.json`]: {
      places: [
        { id: 'g-lystra', name: 'Lystra', featureType: 'City', latitude: 37.61, longitude: 32.32, numberOfReferences: 6 },
        { id: 'g-other', name: 'Other', featureType: 'City', latitude: 1, longitude: 1, numberOfReferences: 1 },
      ],
    },
    [`${GLOBE}/places/g-lystra.json`]: {
      place: {
        id: 'g-lystra',
        name: 'Lystra',
        featureType: 'City',
        latitude: 37.61,
        longitude: 32.32,
        references: [{ book: 'ACT', chapter: 14, verse: 6 }, { book: 'ACT', chapter: 16, verse: 1 }],
      },
    },
  };
}

const context = (fetchImpl: typeof fetch) => ({
  client: new BibleApiClient({ fetch: fetchImpl }),
  profile: getProfile(),
  language: 'es',
});

test('input defaults: RV1909, 20 entities, 10 references, 1500 description chars', () => {
  const input = parseInput(peoplePlacesTimeline, { reference: 'Hch 16:1-15' });
  assert.equal(input.translation, 'spa_r09');
  assert.equal(input.maxEntities, 20);
  assert.equal(input.maxReferences, 10);
  assert.equal(input.descriptionCharLimit, 1500);
  assert.equal(input.entity, undefined);
});

test('input needs exactly one of reference and entity', () => {
  assert.throws(
    () => parseInput(peoplePlacesTimeline, {}),
    (error: unknown) => error instanceof HarnessInputError && /exactly one of "reference".*"entity"/.test(error.message),
  );
  assert.throws(
    () => parseInput(peoplePlacesTimeline, { reference: 'Hch 16', entity: { kind: 'person', name: 'Paul' } }),
    (error: unknown) => error instanceof HarnessInputError && /exactly one of "reference".*"entity"/.test(error.message),
  );
  assert.ok(parseInput(peoplePlacesTimeline, { entity: { kind: 'place', name: 'Lystra' } }).entity);
});

test('input rejects bad references, empty names, unknown kinds and out-of-range limits', () => {
  assert.throws(
    () => parseInput(peoplePlacesTimeline, { reference: 'Tobías 1:1' }),
    (error: unknown) => error instanceof HarnessInputError && /reference.*unknown book "Tobías"/.test(error.message),
  );
  assert.throws(() => parseInput(peoplePlacesTimeline, { entity: { kind: 'person', name: '' } }), HarnessInputError);
  assert.throws(() => parseInput(peoplePlacesTimeline, { entity: { kind: 'angel', name: 'Gabriel' } }), HarnessInputError);
  assert.throws(() => parseInput(peoplePlacesTimeline, { reference: 'Hch 16', maxEntities: 0 }), HarnessInputError);
  assert.throws(() => parseInput(peoplePlacesTimeline, { reference: 'Hch 16', maxEntities: 51 }), HarnessInputError);
  assert.throws(() => parseInput(peoplePlacesTimeline, { reference: 'Hch 16', maxReferences: 51 }), HarnessInputError);
  assert.throws(() => parseInput(peoplePlacesTimeline, { reference: 'Hch 16', descriptionCharLimit: 0 }), HarnessInputError);
});

test('passage mode gathers the text and enriches people, places and events', async () => {
  const fake = fakeFetch(routes());
  const { bundle } = await gatherEvidence(peoplePlacesTimeline, { reference: 'Hch 16:1-3' }, context(fake.fetch));

  assert.equal(bundle.mode, 'passage');
  assert.equal(bundle.reference, 'Hechos 16:1-3');
  assert.deepEqual(bundle.passage?.verses, [
    { chapter: 16, verse: 1, text: 'act1' },
    { chapter: 16, verse: 2, text: 'act2' },
    { chapter: 16, verse: 3, text: 'act3' },
  ]);

  // Most-mentioned in the passage first; Moses (outside) is absent.
  assert.deepEqual(bundle.people.map((p) => p.id), ['timotheus_2863', 'paul_2479']);
  const timothy = bundle.people[0]!;
  assert.deepEqual(timothy.mother, ['Eunice']);
  assert.deepEqual(timothy.father, ['A Greek']);
  assert.deepEqual(timothy.references, ['Hechos 16:1-2']);
  assert.equal(timothy.description, 'Timothy, son of a Jewish mother and a Greek father.');
  const paul = bundle.people[1]!;
  assert.deepEqual(
    [paul.alsoCalled, paul.birthYear, paul.deathYear, paul.birthPlace, paul.memberOf, paul.references],
    [['Saul'], 5, 67, 'Tarsus', ['Apostles'], ['Hechos 16:3']],
  );

  assert.deepEqual(bundle.places.map((p) => p.id), ['lystra_742', 'derbe_330']);
  const lystra = bundle.places[0]!;
  assert.deepEqual(lystra.coordinates, { latitude: 37.6, longitude: 32.3 });
  assert.equal(lystra.featureType, 'City');
  assert.deepEqual(lystra.references, ['Hechos 16:1-2']);
  assert.equal(lystra.historyGlobe?.id, 'g-lystra');
  assert.deepEqual(lystra.historyGlobe?.coordinates, { latitude: 37.61, longitude: 32.32 });
  assert.deepEqual(lystra.historyGlobe?.references, ['Hechos 14:6', 'Hechos 16:1']);
  assert.ok(typeof lystra.historyGlobe?.distanceKm === 'number' && lystra.historyGlobe.distanceKm < 5);
  assert.equal(bundle.places[1]!.historyGlobe, undefined);

  const joins = bundle.events.find((e) => e.id === 'timothy-joins_349')!;
  assert.deepEqual(
    [joins.startDate, joins.year, joins.date, joins.duration, joins.participants, joins.locations, joins.predecessor, joins.references],
    ['0047-05-01', 47, '47 d.C.', '1D', ['Paul', 'Timotheus'], ['Lystra'], 'Second Missionary Journey', ['Hechos 16:1-3']],
  );
  assert.deepEqual(bundle.omitted, { people: 0, places: 0, events: 0 });
});

test('passage mode orders the timeline by year with undated entries last', async () => {
  const fake = fakeFetch(routes());
  const { bundle } = await gatherEvidence(peoplePlacesTimeline, { reference: 'Hch 16:1-3' }, context(fake.fetch));

  assert.deepEqual(
    bundle.timeline.dated.map((e) => [e.type, e.name, e.year, e.date]),
    [
      ['birth', 'Paul', 5, '5 d.C.'],
      ['event', 'Second Missionary Journey', 46, '46 d.C.'],
      ['event', 'Timothy Joins Paul and Silas', 47, '47 d.C.'],
      ['death', 'Paul', 67, '67 d.C.'],
    ],
  );
  assert.deepEqual(bundle.timeline.undated.map((e) => [e.type, e.id, e.name]), [['event', 'circumcision_9', 'Timothy Circumcised']]);
  assert.deepEqual(bundle.timeline.dated[1]!.references, ['Hechos 16:1-3']);
});

test('passage mode caps enrichment per kind at maxEntities and reports the omissions', async () => {
  const fake = fakeFetch(routes());
  const { bundle } = await gatherEvidence(peoplePlacesTimeline, { reference: 'Hch 16:1-3', maxEntities: 1 }, context(fake.fetch));

  assert.deepEqual(bundle.people.map((p) => p.id), ['timotheus_2863']);
  assert.deepEqual(bundle.places.map((p) => p.id), ['lystra_742']);
  assert.equal(bundle.events.length, 1);
  assert.deepEqual(bundle.omitted, { people: 1, places: 1, events: 2 });
  assert.ok(!fake.calls.some((url) => url.endsWith('/people/paul_2479.json')));
  assert.ok(!fake.calls.some((url) => url.endsWith('/places/derbe_330.json')));
});

test('passage mode lists sources, licenses and the Easton note', async () => {
  const fake = fakeFetch(routes());
  const { bundle } = await gatherEvidence(peoplePlacesTimeline, { reference: 'Hch 16:1-3' }, context(fake.fetch));
  assert.ok(bundle.sources.some((s) => s.includes('spa_r09')));
  assert.ok(bundle.sources.includes('Theographic Bible Metadata, CC BY-SA 4.0'));
  assert.ok(bundle.sources.includes('History Globe, CC BY 4.0'));
  assert.ok(bundle.sources.some((s) => s.includes("Easton's Bible Dictionary (1897)")));
});

test('passage mode truncates descriptions to descriptionCharLimit', async () => {
  const fake = fakeFetch(routes());
  const { bundle } = await gatherEvidence(
    peoplePlacesTimeline,
    { reference: 'Hch 16:3', descriptionCharLimit: 10 },
    context(fake.fetch),
  );
  assert.equal(bundle.people[0]!.description, `${'A'.repeat(10)} […truncated]`);
});

test('passage mode without theographic coverage yields empty lists', async () => {
  const fake = fakeFetch({ '/api/spa_r09/ACT/16.json': chapterFixture('spa_r09', 'ACT', 16, verses('act', 15)) });
  const { bundle } = await gatherEvidence(peoplePlacesTimeline, { reference: 'Hch 16:1' }, context(fake.fetch));
  assert.deepEqual([bundle.people, bundle.places, bundle.events], [[], [], []]);
  assert.deepEqual(bundle.timeline, { dated: [], undated: [] });
});

const peopleIndex = {
  people: [
    { id: 'david_994', name: 'David', numberOfReferences: 1100 },
    { id: 'david_55', name: 'David', numberOfReferences: 2 },
    { id: 'davidson_3', name: 'Davidson', numberOfReferences: 5 },
  ],
};

function entityRoutes() {
  return {
    [`${THEO}/people.json`]: peopleIndex,
    [`${THEO}/people/david_994.json`]: {
      person: {
        id: 'david_994',
        name: 'David',
        gender: 'Male',
        description: ['Beloved, the youngest son of Jesse.'],
        birthYear: -1085,
        deathYear: -1015,
        father: [link('people', 'jesse_903', 'Jesse')],
        events: [link('events', 'david-kills-goliath_157', 'David Kills Goliath'), link('events', 'death-of-david_160', 'Death of David')],
        references: [
          { book: '1SA', chapter: 16, verse: 13 },
          { book: '1SA', chapter: 17, verse: 45 },
          { book: 'PSA', chapter: 23, verse: 1 },
        ],
      },
    },
    [`${THEO}/events/david-kills-goliath_157.json`]: {
      event: { id: 'david-kills-goliath_157', name: 'David Kills Goliath', startDate: '-1063', references: [{ book: '1SA', chapter: 17, verse: 1, endVerse: 58 }] },
    },
    [`${THEO}/events/death-of-david_160.json`]: {
      event: { id: 'death-of-david_160', name: 'Death of David', startDate: '-1015', references: [{ book: '1KI', chapter: 2, verse: 10 }] },
    },
    '/api/spa_r09/1SA/16.json': chapterFixture('spa_r09', '1SA', 16, verses('sa16-', 23)),
    '/api/spa_r09/1SA/17.json': chapterFixture('spa_r09', '1SA', 17, verses('sa17-', 58)),
    '/api/spa_r09/PSA/23.json': chapterFixture('spa_r09', 'PSA', 23, verses('psa23-', 6)),
  };
}

test('entity mode takes the best match, lists the others and fetches texts up to maxReferences', async () => {
  const fake = fakeFetch(entityRoutes());
  const { bundle } = await gatherEvidence(
    peoplePlacesTimeline,
    { entity: { kind: 'person', name: 'david' }, maxReferences: 2 },
    context(fake.fetch),
  );

  assert.equal(bundle.mode, 'entity');
  assert.deepEqual(bundle.entity, { kind: 'person', id: 'david_994', name: 'David', totalReferences: 3 });
  assert.deepEqual(bundle.otherMatches, [
    { id: 'david_55', name: 'David', numberOfReferences: 2 },
    { id: 'davidson_3', name: 'Davidson', numberOfReferences: 5 },
  ]);
  assert.deepEqual(bundle.people.map((p) => [p.id, p.birthYear, p.father]), [['david_994', -1085, ['Jesse']]]);
  assert.deepEqual(bundle.referenceTexts, [
    { reference: '1 Samuel 16:13', text: 'sa16-13' },
    { reference: '1 Samuel 17:45', text: 'sa17-45' },
  ]);
  assert.ok(!fake.calls.some((url) => url.includes('/PSA/23.json')));
  assert.deepEqual(bundle.people[0]!.references, ['1 Samuel 16:13', '1 Samuel 17:45']);

  // Related events of a person carry names and years and feed the timeline.
  assert.deepEqual(bundle.events.map((e) => [e.name, e.year, e.date]), [
    ['David Kills Goliath', -1063, '1063 a.C.'],
    ['Death of David', -1015, '1015 a.C.'],
  ]);
  assert.deepEqual(
    bundle.timeline.dated.map((e) => [e.type, e.name, e.year]),
    [
      ['birth', 'David', -1085],
      ['event', 'David Kills Goliath', -1063],
      ['event', 'Death of David', -1015],
      ['death', 'David', -1015],
    ],
  );
  assert.ok(bundle.sources.some((s) => s.includes('spa_r09')));
});

test('entity mode with maxReferences 0 fetches no verse texts', async () => {
  const fake = fakeFetch(entityRoutes());
  const { bundle } = await gatherEvidence(
    peoplePlacesTimeline,
    { entity: { kind: 'person', name: 'David' }, maxReferences: 0 },
    context(fake.fetch),
  );
  assert.deepEqual(bundle.referenceTexts, []);
  assert.ok(!fake.calls.some((url) => url.includes('/api/spa_r09/')));
});

test('entity mode throws naming the kind and the name when nothing matches', async () => {
  const fake = fakeFetch(entityRoutes());
  await assert.rejects(
    gatherEvidence(peoplePlacesTimeline, { entity: { kind: 'person', name: 'Zzyzx' } }, context(fake.fetch)),
    /No person matches "Zzyzx" in Theographic\. Names are in English \(e\.g\. "Bethlehem", "Peter"\)/,
  );
});

test('entity names are documented as English in the input schema', async () => {
  const { renderSkill } = await import('../../src/harness/skill.ts');
  assert.match(renderSkill(peoplePlacesTimeline), /English name as Theographic spells it/);
});

test('entity mode for an event lists participants and locations', async () => {
  const fake = fakeFetch({
    ...routes(),
    [`${THEO}/events.json`]: { events: [{ id: 'timothy-joins_349', name: 'Timothy Joins Paul and Silas', startDate: '0047-05-01', numberOfReferences: 5 }] },
    '/api/spa_r09/ACT/16.json': chapterFixture('spa_r09', 'ACT', 16, verses('act', 15)),
  });
  const { bundle } = await gatherEvidence(
    peoplePlacesTimeline,
    { entity: { kind: 'event', name: 'timothy joins' }, maxReferences: 3 },
    context(fake.fetch),
  );
  assert.deepEqual(bundle.events.map((e) => [e.id, e.participants, e.locations, e.date]), [
    ['timothy-joins_349', ['Paul', 'Timotheus'], ['Lystra'], '47 d.C.'],
  ]);
  assert.deepEqual(bundle.referenceTexts.map((r) => r.reference), ['Hechos 16:1-5']);
  assert.equal(bundle.referenceTexts[0]!.text, 'act1 act2 act3 act4 act5');
  assert.deepEqual(bundle.timeline.dated.map((e) => e.name), ['Timothy Joins Paul and Silas']);
  assert.equal(bundle.otherMatches?.length, 0);
});

test('entity mode for a place adds the History Globe match', async () => {
  const fake = fakeFetch({
    ...routes(),
    [`${THEO}/places.json`]: { places: [{ id: 'lystra_742', name: 'Lystra', featureType: 'City', latitude: 37.6, longitude: 32.3, numberOfReferences: 6 }] },
  });
  const { bundle } = await gatherEvidence(
    peoplePlacesTimeline,
    { entity: { kind: 'place', name: 'Lystra' }, maxReferences: 0 },
    context(fake.fetch),
  );
  assert.deepEqual(bundle.places.map((p) => [p.id, p.coordinates, p.historyGlobe?.id]), [
    ['lystra_742', { latitude: 37.6, longitude: 32.3 }, 'g-lystra'],
  ]);
  assert.deepEqual(bundle.places[0]!.references, []);
  assert.equal(bundle.entity?.totalReferences, 1);
});

test('entity mode for a group lists its members', async () => {
  const fake = fakeFetch({
    [`${THEO}/groups.json`]: { groups: [{ id: 'apostles', name: 'Apostles', numberOfMembers: 2 }, { id: 'apostles-the-eleven', name: 'Apostles (The Eleven)', numberOfMembers: 11 }] },
    [`${THEO}/groups/apostles.json`]: {
      group: {
        id: 'apostles',
        name: 'Apostles',
        members: [link('people', 'peter_2745', 'Simon Peter'), link('people', 'andrew_264', 'Andrew')],
        events: [link('events', 'x_1', 'Some Event')],
        references: [],
      },
    },
    [`${THEO}/events/x_1.json`]: { event: { id: 'x_1', name: 'Some Event', startDate: '29' } },
  });
  const { bundle } = await gatherEvidence(peoplePlacesTimeline, { entity: { kind: 'group', name: 'Apostles' } }, context(fake.fetch));
  assert.deepEqual(bundle.groups.map((g) => [g.id, g.members]), [['apostles', ['Simon Peter', 'Andrew']]]);
  assert.deepEqual(bundle.otherMatches, [{ id: 'apostles-the-eleven', name: 'Apostles (The Eleven)', numberOfReferences: 0, numberOfMembers: 11 }]);
  assert.deepEqual(bundle.events.map((e) => [e.name, e.year]), [['Some Event', 29]]);
});

test('registry exposes people-places-timeline', async () => {
  const { getHarness } = await import('../../src/harnesses/index.ts');
  assert.equal(getHarness('people-places-timeline'), peoplePlacesTimeline);
});
