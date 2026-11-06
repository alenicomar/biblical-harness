import { z } from 'zod';
import type { BibleApiClient } from '../core/client.ts';
import { getPassage, type PassageVerse, type VerseLocation } from '../core/passage.ts';
import { formatReference, parseReference } from '../core/reference.ts';
import {
  distanceKm,
  formatBibleRef,
  formatYear,
  getEvent,
  getGroup,
  getHistoryGlobePlace,
  getPassageEntities,
  getPerson,
  getPlace,
  loadHistoryGlobeIndex,
  matchHistoryGlobePlace,
  parseYear,
  passageRefOf,
  searchEntities,
  type BibleRef,
  type EntityKind,
  type EntityLink,
  type HistoryGlobePlaceItem,
  type IndexItem,
  type TheographicEvent,
  type TheographicGroup,
  type TheographicPerson,
  type TheographicPlace,
} from '../core/theographic.ts';
import { defineHarness } from '../harness/contract.ts';
import { applicationSchema, confidenceSchema, referenceSchema, translationSchema, truncate } from './shared.ts';

const input = z
  .object({
    reference: referenceSchema('Passage mode: the passage whose people, places and events to study, e.g. "Hch 16:1-15".').optional(),
    entity: z
      .object({
        kind: z.enum(['person', 'place', 'event', 'group']).describe('What the name designates.'),
        name: z
          .string()
          .min(1)
          .describe(
            'English name as Theographic spells it, e.g. "David", "Bethlehem", "Philippi", "The Exodus" (translate Spanish names: Belén → Bethlehem, Pedro → Peter). Accents and case are ignored.',
          ),
      })
      .optional()
      .describe('Entity mode: one biblical person, place, event or group to study across the Bible.'),
    translation: translationSchema(),
    maxEntities: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe('Passage mode: entities enriched per kind, most mentioned in the passage first. Entity mode: related events kept.'),
    maxReferences: z
      .number()
      .int()
      .min(0)
      .max(50)
      .default(10)
      .describe('Entity mode: verse texts fetched for the entity (first references in canonical order). Passage mode only fetches the passage text.'),
    descriptionCharLimit: z.number().int().min(1).default(1500).describe("Maximum characters kept per dictionary description (Easton's, 1897)."),
  })
  .superRefine((value, ctx) => {
    if ((value.reference === undefined) === (value.entity === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'give exactly one of "reference" (passage mode) or "entity" (entity mode)' });
    }
  });

const output = z.object({
  summary: z.string().describe('Who, where and when in two or three sentences, as far as the evidence shows.'),
  people: z.array(
    z.object({
      name: z.string(),
      identification: z.string().describe('Who this is, distinguished from namesakes by id or references.'),
      role: z.string().describe('Role in the passage, or in the biblical story for entity mode.'),
      relations: z.array(z.string()).describe('Family, group membership and co-participants, e.g. "son of Jesse".'),
      dates: z.string().optional().describe('Approximate life dates from the evidence, hedged.'),
      references: z.array(z.string()),
    }),
  ),
  places: z.array(
    z.object({
      name: z.string(),
      type: z.string().describe('City, region, water, landmark, etc.'),
      coordinates: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
      identificationConfidence: confidenceSchema.describe('How secure the identification and its coordinates are.'),
      significance: z.string().describe('What happens here and why it matters for the text.'),
      references: z.array(z.string()),
    }),
  ),
  timeline: z.array(
    z.object({
      date: z.string().describe('Approximate date, e.g. "c. 46-48 d.C.", or "undated".'),
      event: z.string(),
      references: z.array(z.string()),
      dateConfidence: confidenceSchema.describe('How firm the dating is; the dataset follows a single chronology.'),
    }),
  ),
  historicalContext: z.string().describe('Political, social and religious setting; flag background not in the evidence.'),
  geographyNotes: z.string().describe('How the geography (distances, routes, terrain) shapes the narrative.'),
  disambiguation: z.array(z.string()).describe('People or places sharing a name, as the evidence shows, and how to tell them apart.'),
  uncertainties: z.array(z.string()).describe('Dates, identifications or coordinates the evidence leaves open.'),
  application: z.array(applicationSchema),
  sources: z.array(z.string()).describe('Translations and datasets used.'),
});

export interface BundlePerson {
  id: string;
  name: string;
  alsoCalled: string[];
  gender?: string;
  birthYear?: number;
  deathYear?: number;
  /** Earliest and latest years the person is attested, per the dataset. */
  minYear?: number;
  maxYear?: number;
  birthPlace?: string;
  deathPlace?: string;
  father: string[];
  mother: string[];
  partners: string[];
  children: string[];
  siblings: string[];
  memberOf: string[];
  /** Easton's Bible Dictionary (1897), truncated. */
  description?: string;
  /** Passage mode: the verses of the passage that mention the person. Entity mode: the first references. */
  references: string[];
}

export interface BundleHistoryGlobe {
  id: string;
  coordinates: { latitude: number; longitude: number };
  /** Kilometres between the Theographic and the History Globe coordinates. */
  distanceKm?: number;
  references: string[];
  totalReferences: number;
}

export interface BundlePlace {
  id: string;
  name: string;
  kjvName?: string;
  esvName?: string;
  featureType?: string;
  coordinates?: { latitude: number; longitude: number };
  /** Easton's Bible Dictionary (1897), truncated. */
  description?: string;
  references: string[];
  historyGlobe?: BundleHistoryGlobe;
}

export interface BundleEvent {
  id: string;
  name: string;
  startDate?: string;
  year?: number;
  /** Formatted year, e.g. "46 d.C." */
  date?: string;
  duration?: string;
  participants: string[];
  locations: string[];
  partOf?: string;
  predecessor?: string;
  references: string[];
}

export interface BundleGroup {
  id: string;
  name: string;
  members: string[];
  events: string[];
  references: string[];
}

export interface TimelineEntry {
  type: 'event' | 'birth' | 'death';
  id: string;
  name: string;
  year?: number;
  date?: string;
  references: string[];
}

export interface PeoplePlacesBundle {
  mode: 'passage' | 'entity';
  reference?: string;
  passage?: { reference: string; translation: string; verses: PassageVerse[] };
  /** Entity mode: the best match for the requested name. */
  entity?: { kind: EntityKind; id: string; name: string; totalReferences: number };
  people: BundlePerson[];
  places: BundlePlace[];
  events: BundleEvent[];
  groups: BundleGroup[];
  /** Events and the births and deaths of people, by year; entries without a year come last. */
  timeline: { dated: TimelineEntry[]; undated: TimelineEntry[] };
  /** Entity mode: other index entries matching the name, for disambiguation. */
  otherMatches?: Array<{ id: string; name: string; numberOfReferences: number; numberOfMembers?: number }>;
  /** Entity mode: verse texts of the first references of the entity. */
  referenceTexts: Array<{ reference: string; text: string }>;
  /** Passage mode: entities left out by `maxEntities`, per kind. */
  omitted?: { people: number; places: number; events: number };
  sources: string[];
}

const MAX_OTHER_MATCHES = 5;
/** References kept for History Globe places and for related events. */
const REFERENCE_PREVIEW = 10;
const RELATED_EVENT_REFERENCES = 5;

type Params = z.output<typeof input>;

export const peoplePlacesTimeline = defineHarness({
  id: 'people-places-timeline',
  title: 'People, places and timeline',
  summary:
    'Use when studying the people, places and events of a passage, or one biblical person, place or event: who they are, where (with coordinates), when (timeline) and how they relate, from Theographic and History Globe.',
  input,
  output,
  method: [
    'Read the passage (or the entity’s key references) in context before using any background data.',
    'Identify each person, place and event; distinguish namesakes using ids and references, never merging them.',
    'Place the events on the timeline, stating the dating basis (the dataset’s single chronology) and how uncertain it is.',
    'Locate the places with their coordinates and explain how the geography (distances, routes, terrain) shapes the narrative.',
    'Trace the relations: family, group membership, participants of each event.',
    'Connect the people, places and events to the wider biblical storyline.',
    'State the uncertainties: contested dates, doubtful identifications, coordinates that disagree between datasets.',
    'Draw applications from the text itself, not from the background alone.',
  ],
  guardrails: [
    'Dates are approximate reconstructions from one chronology (Theographic). Present them as approximate and note that scholars differ (e.g. early vs late Exodus).',
    'Place identifications and coordinates can be uncertain; say so, especially when Theographic and History Globe disagree.',
    'Dictionary descriptions come from Easton’s Bible Dictionary (1897) and are secondary sources: attribute them and prefer the biblical text.',
    'Do not merge different people (or places) who share a name; use the ids and references to tell them apart.',
    'Background illuminates the text; it does not replace it.',
  ],
  async gather(params, { client }): Promise<PeoplePlacesBundle> {
    return params.reference !== undefined ? gatherPassage(client, params, params.reference) : gatherEntity(client, params);
  },
});

async function gatherPassage(client: BibleApiClient, params: Params, reference: string): Promise<PeoplePlacesBundle> {
  const ref = parseReference(reference);
  const passage = await getPassage(client, params.translation, ref);
  const found = await getPassageEntities(client, ref);
  const top = <T extends { verses: unknown[] }>(items: readonly T[]) =>
    [...items].sort((a, b) => b.verses.length - a.verses.length).slice(0, params.maxEntities);
  const runs = (verses: VerseLocation[]) => verseRuns(ref.book, verses);

  const people: BundlePerson[] = [];
  for (const item of top(found.people)) {
    people.push(personBundle(await getPerson(client, item.id), runs(item.verses), params));
  }

  const places: BundlePlace[] = [];
  const keptPlaces = top(found.places);
  const globe = keptPlaces.length > 0 ? await loadHistoryGlobeIndex(client) : [];
  for (const item of keptPlaces) {
    places.push(await placeBundle(client, await getPlace(client, item.id), runs(item.verses), params, globe));
  }

  const events: BundleEvent[] = [];
  for (const item of top(found.events)) {
    const event = await getEvent(client, item.id);
    events.push(eventBundle({ ...event, startDate: event.startDate ?? item.startDate }, runs(item.verses)));
  }

  const translation = `${passage.translation.name} (${passage.translation.id})`;
  return {
    mode: 'passage',
    reference: passage.reference,
    passage: { reference: passage.reference, translation, verses: passage.verses },
    people,
    places,
    events,
    groups: [],
    timeline: buildTimeline(events, people),
    referenceTexts: [],
    omitted: {
      people: found.people.length - people.length,
      places: found.places.length - places.length,
      events: found.events.length - events.length,
    },
    sources: sourceNotes(translation),
  };
}

async function gatherEntity(client: BibleApiClient, params: Params): Promise<PeoplePlacesBundle> {
  const { kind, name } = params.entity!;
  const matches: IndexItem[] = await searchEntities(client, kind, name, { limit: 1 + MAX_OTHER_MATCHES });
  const [best, ...others] = matches;
  if (!best) {
    throw new Error(
      `No ${kind} matches "${name}" in Theographic. Names are in English (e.g. "Bethlehem", "Peter"); try the English name, another spelling or another kind (person, place, event, group).`,
    );
  }

  const bundle: PeoplePlacesBundle = {
    mode: 'entity',
    people: [],
    places: [],
    events: [],
    groups: [],
    timeline: { dated: [], undated: [] },
    otherMatches: others.map((other) => ({
      id: other.id,
      name: other.name,
      numberOfReferences: other.numberOfReferences ?? 0,
      ...('numberOfMembers' in other && other.numberOfMembers !== undefined ? { numberOfMembers: other.numberOfMembers } : {}),
    })),
    referenceTexts: [],
    sources: [],
  };

  let references: BibleRef[] = [];
  let related: EntityLink[] = [];
  const shown = (all: BibleRef[]) => all.slice(0, params.maxReferences);

  if (kind === 'person') {
    const person = await getPerson(client, best.id);
    references = person.references ?? [];
    related = person.events ?? [];
    bundle.people.push(personBundle(person, shown(references).map(formatBibleRef), params));
  } else if (kind === 'place') {
    const place = await getPlace(client, best.id);
    references = place.references ?? [];
    related = place.events ?? [];
    const globe = await loadHistoryGlobeIndex(client);
    bundle.places.push(await placeBundle(client, place, shown(references).map(formatBibleRef), params, globe));
  } else if (kind === 'event') {
    const event = await getEvent(client, best.id);
    references = event.references ?? [];
    bundle.events.push(eventBundle(event, shown(references).map(formatBibleRef)));
  } else {
    const group = await getGroup(client, best.id);
    references = group.references ?? [];
    related = group.events ?? [];
    bundle.groups.push(groupBundle(group, shown(references).map(formatBibleRef)));
  }

  for (const link of related.slice(0, params.maxEntities)) {
    const event = await getEvent(client, link.id);
    bundle.events.push(eventBundle(event, (event.references ?? []).slice(0, RELATED_EVENT_REFERENCES).map(formatBibleRef)));
  }

  let translation = params.translation;
  for (const reference of shown(references)) {
    const passageRef = passageRefOf(reference);
    if (!passageRef) continue;
    const passage = await getPassage(client, params.translation, passageRef);
    translation = `${passage.translation.name} (${passage.translation.id})`;
    bundle.referenceTexts.push({ reference: passage.reference, text: passage.verses.map((verse) => verse.text).join(' ') });
  }

  bundle.entity = { kind, id: best.id, name: best.name, totalReferences: references.length };
  bundle.timeline = buildTimeline(bundle.events, bundle.people);
  bundle.sources = sourceNotes(translation);
  return bundle;
}

function sourceNotes(translation: string): string[] {
  return [
    `Translation: ${translation}`,
    'Theographic Bible Metadata, CC BY-SA 4.0',
    'History Globe, CC BY 4.0',
    "Theographic descriptions come from Easton's Bible Dictionary (1897), a secondary source; dates follow one chronology and are approximate.",
  ];
}

const linkNames = (links: readonly EntityLink[] | undefined): string[] => (links ?? []).map((link) => link.name);

function describe(description: readonly string[] | undefined, params: Params): string | undefined {
  const text = (description ?? []).join('\n\n').trim();
  return text === '' ? undefined : truncate(text, params.descriptionCharLimit);
}

function personBundle(person: TheographicPerson, references: string[], params: Params): BundlePerson {
  return {
    id: person.id,
    name: person.name,
    alsoCalled: person.alsoCalled ?? [],
    gender: person.gender,
    birthYear: person.birthYear,
    deathYear: person.deathYear,
    minYear: person.minYear,
    maxYear: person.maxYear,
    birthPlace: person.birthPlace?.name,
    deathPlace: person.deathPlace?.name,
    father: linkNames(person.father),
    mother: linkNames(person.mother),
    partners: linkNames(person.partners),
    children: linkNames(person.children),
    siblings: linkNames(person.siblings),
    memberOf: linkNames(person.memberOf),
    description: describe(person.description, params),
    references,
  };
}

async function placeBundle(
  client: BibleApiClient,
  place: TheographicPlace,
  references: string[],
  params: Params,
  globe: readonly HistoryGlobePlaceItem[],
): Promise<BundlePlace> {
  const located = place.latitude !== undefined && place.longitude !== undefined;
  const bundle: BundlePlace = {
    id: place.id,
    name: place.name,
    kjvName: place.kjvName,
    esvName: place.esvName,
    featureType: place.featureType,
    coordinates: located ? { latitude: place.latitude!, longitude: place.longitude! } : undefined,
    description: describe(place.description, params),
    references,
  };

  const match = matchHistoryGlobePlace(globe, place.name, place.latitude, place.longitude);
  if (match) {
    const detail = await getHistoryGlobePlace(client, match.id);
    bundle.historyGlobe = {
      id: match.id,
      coordinates: { latitude: match.latitude, longitude: match.longitude },
      distanceKm: located ? Math.round(distanceKm(place.latitude!, place.longitude!, match.latitude, match.longitude)) : undefined,
      references: (detail.references ?? []).slice(0, REFERENCE_PREVIEW).map(formatBibleRef),
      totalReferences: (detail.references ?? []).length,
    };
  }
  return bundle;
}

function eventBundle(event: TheographicEvent, references: string[]): BundleEvent {
  const year = parseYear(event.startDate);
  return {
    id: event.id,
    name: event.name,
    startDate: event.startDate,
    year,
    date: year === undefined ? undefined : formatYear(year),
    duration: event.duration,
    participants: linkNames(event.participants),
    locations: linkNames(event.locations),
    partOf: event.partOf?.name,
    predecessor: event.predecessor?.name,
    references,
  };
}

function groupBundle(group: TheographicGroup, references: string[]): BundleGroup {
  return { id: group.id, name: group.name, members: linkNames(group.members), events: linkNames(group.events), references };
}

/** Events first, then births and deaths; a stable sort keeps that order among equal years. */
function buildTimeline(events: readonly BundleEvent[], people: readonly BundlePerson[]): PeoplePlacesBundle['timeline'] {
  const dated: TimelineEntry[] = [];
  const undated: TimelineEntry[] = [];
  for (const event of events) {
    const entry: TimelineEntry = { type: 'event', id: event.id, name: event.name, year: event.year, date: event.date, references: event.references };
    (event.year === undefined ? undated : dated).push(entry);
  }
  for (const person of people) {
    for (const [type, year] of [['birth', person.birthYear], ['death', person.deathYear]] as const) {
      if (year !== undefined) dated.push({ type, id: person.id, name: person.name, year, date: formatYear(year), references: person.references });
    }
  }
  dated.sort((a, b) => a.year! - b.year!);
  return { dated, undated };
}

/** Consecutive verses of a chapter collapsed into ranges: "Hechos 16:1-3". */
function verseRuns(book: string, verses: readonly VerseLocation[]): string[] {
  const runs: Array<{ chapter: number; first: number; last: number }> = [];
  for (const { chapter, verse } of [...verses].sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)) {
    const run = runs.at(-1);
    if (run && run.chapter === chapter && verse <= run.last + 1) run.last = Math.max(run.last, verse);
    else runs.push({ chapter, first: verse, last: verse });
  }
  return runs.map((run) =>
    formatReference({ book, startChapter: run.chapter, startVerse: run.first, endChapter: run.chapter, endVerse: run.last }),
  );
}
