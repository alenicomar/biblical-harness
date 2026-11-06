import { findBook } from './books.ts';
import type { BibleApiClient } from './client.ts';
import type { VerseLocation } from './passage.ts';
import { chaptersOf, containsVerse, formatReference, type PassageRef } from './reference.ts';

export const THEOGRAPHIC = 'theographic';
export const HISTORY_GLOBE = 'history-globe';

export type EntityKind = 'person' | 'place' | 'event' | 'group';

/** Directory (and index file) name of each entity kind in the dataset. */
const COLLECTION = { person: 'people', place: 'places', event: 'events', group: 'groups' } as const;

/** Link to another entity inside an entity file. */
export interface EntityLink {
  id: string;
  type?: string;
  name: string;
  apiLink?: string;
}

/** A verse (or verse range, when `endVerse` is set) in the book of the surrounding file. */
export interface BibleRef {
  book: string;
  chapter: number;
  verse: number;
  endVerse?: number;
}

export interface TheographicPerson {
  id: string;
  name: string;
  alsoCalled?: string[];
  isProperName?: boolean;
  gender?: string;
  /** Easton's Bible Dictionary (1897), one string per paragraph block. */
  description?: string[];
  birthYear?: number;
  deathYear?: number;
  minYear?: number;
  maxYear?: number;
  birthPlace?: EntityLink;
  deathPlace?: EntityLink;
  father?: EntityLink[];
  mother?: EntityLink[];
  partners?: EntityLink[];
  children?: EntityLink[];
  siblings?: EntityLink[];
  halfSiblingsSameFather?: EntityLink[];
  halfSiblingsSameMother?: EntityLink[];
  memberOf?: EntityLink[];
  events?: EntityLink[];
  references?: BibleRef[];
}

export interface TheographicPlace {
  id: string;
  name: string;
  kjvName?: string;
  esvName?: string;
  featureType?: string;
  latitude?: number;
  longitude?: number;
  description?: string[];
  events?: EntityLink[];
  references?: BibleRef[];
}

export interface TheographicEvent {
  id: string;
  name: string;
  /** Year as a string, negative for B.C.; may carry month and day ("0047-05-01"). */
  startDate?: string;
  duration?: string;
  participants?: EntityLink[];
  locations?: EntityLink[];
  partOf?: EntityLink;
  predecessor?: EntityLink;
  references?: BibleRef[];
}

export interface TheographicGroup {
  id: string;
  name: string;
  members?: EntityLink[];
  events?: EntityLink[];
  references?: BibleRef[];
}

/** An item of a theographic chapter file; `verses` are plain verse numbers of that chapter. */
export type ChapterPerson = Pick<TheographicPerson, 'id' | 'name' | 'gender' | 'isProperName'> & { verses: number[] };
export type ChapterPlace = Pick<TheographicPlace, 'id' | 'name' | 'featureType' | 'latitude' | 'longitude'> & { verses: number[] };
export type ChapterEvent = Pick<TheographicEvent, 'id' | 'name' | 'startDate'> & { verses: number[] };

export interface TheographicChapter {
  chapter: { number: number; people?: ChapterPerson[]; places?: ChapterPlace[]; events?: ChapterEvent[] };
}

export interface PersonIndexItem {
  id: string;
  name: string;
  /** Not present in every index version. */
  alsoCalled?: string[];
  gender?: string;
  numberOfReferences?: number;
}

export interface PlaceIndexItem {
  id: string;
  name: string;
  featureType?: string;
  latitude?: number;
  longitude?: number;
  numberOfReferences?: number;
}

export interface EventIndexItem {
  id: string;
  name: string;
  startDate?: string;
  numberOfReferences?: number;
}

export interface GroupIndexItem {
  id: string;
  name: string;
  numberOfMembers?: number;
  numberOfReferences?: number;
}

export interface IndexItems {
  person: PersonIndexItem;
  place: PlaceIndexItem;
  event: EventIndexItem;
  group: GroupIndexItem;
}

export type IndexItem = IndexItems[EntityKind];

export interface HistoryGlobePlaceItem {
  id: string;
  name: string;
  featureType?: string;
  latitude: number;
  longitude: number;
  numberOfReferences?: number;
}

export interface HistoryGlobePlace extends HistoryGlobePlaceItem {
  references?: BibleRef[];
}

/** A chapter item narrowed to the verses inside the passage, as `{ chapter, verse }`. */
export type InPassage<T extends { verses: number[] }> = Omit<T, 'verses'> & { verses: VerseLocation[] };

export interface PassageEntities {
  people: Array<InPassage<ChapterPerson>>;
  places: Array<InPassage<ChapterPlace>>;
  events: Array<InPassage<ChapterEvent>>;
}

/**
 * People, places and events whose verses intersect the passage, across all of its
 * chapters. An entity listed in several chapters is merged by id; only the verses
 * inside the passage are kept. Chapters the dataset does not cover are skipped.
 */
export async function getPassageEntities(client: BibleApiClient, ref: PassageRef): Promise<PassageEntities> {
  const found: PassageEntities = { people: [], places: [], events: [] };

  for (const chapter of chaptersOf(ref)) {
    const data = await client.tryDatasetChapter<TheographicChapter>(THEOGRAPHIC, ref.book, chapter);
    if (!data) continue;
    mergeInto(found.people, data.chapter.people, ref, chapter);
    mergeInto(found.places, data.chapter.places, ref, chapter);
    mergeInto(found.events, data.chapter.events, ref, chapter);
  }
  return found;
}

function mergeInto<T extends { id: string; verses: number[] }>(
  into: Array<InPassage<T>>,
  items: readonly T[] | undefined,
  ref: PassageRef,
  chapter: number,
): void {
  for (const item of items ?? []) {
    const verses = item.verses.filter((verse) => containsVerse(ref, chapter, verse)).map((verse) => ({ chapter, verse }));
    if (verses.length === 0) continue;
    const known = into.find((entry) => entry.id === item.id);
    if (known) known.verses.push(...verses);
    else into.push({ ...item, verses });
  }
}

export async function getPerson(client: BibleApiClient, id: string): Promise<TheographicPerson> {
  return (await client.datasetEntity<{ person: TheographicPerson }>(THEOGRAPHIC, COLLECTION.person, id)).person;
}

export async function getPlace(client: BibleApiClient, id: string): Promise<TheographicPlace> {
  return (await client.datasetEntity<{ place: TheographicPlace }>(THEOGRAPHIC, COLLECTION.place, id)).place;
}

export async function getEvent(client: BibleApiClient, id: string): Promise<TheographicEvent> {
  return (await client.datasetEntity<{ event: TheographicEvent }>(THEOGRAPHIC, COLLECTION.event, id)).event;
}

export async function getGroup(client: BibleApiClient, id: string): Promise<TheographicGroup> {
  return (await client.datasetEntity<{ group: TheographicGroup }>(THEOGRAPHIC, COLLECTION.group, id)).group;
}

/** Lowercase, diacritics stripped, whitespace collapsed: "  José  " -> "jose". */
export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** 0 exact, 1 prefix, 2 substring, undefined when no name matches. */
function matchTier(names: readonly string[], query: string): number | undefined {
  let best: number | undefined;
  for (const name of names) {
    const normalized = normalizeName(name);
    const tier = normalized === query ? 0 : normalized.startsWith(query) ? 1 : normalized.includes(query) ? 2 : undefined;
    if (tier !== undefined && (best === undefined || tier < best)) best = tier;
  }
  return best;
}

/**
 * Index items of one kind whose name matches, accent- and case-insensitively: exact
 * matches first, then prefix, then substring; ties by number of references, most
 * attested first. People also match `alsoCalled` when the index carries it.
 */
export async function searchEntities<K extends EntityKind>(
  client: BibleApiClient,
  kind: K,
  name: string,
  options: { limit?: number } = {},
): Promise<Array<IndexItems[K]>> {
  const query = normalizeName(name);
  if (query === '') return [];
  const collection = COLLECTION[kind];
  const index = await client.datasetIndex<Record<string, Array<IndexItems[K]>>>(THEOGRAPHIC, collection);

  const matches: Array<{ item: IndexItems[K]; tier: number }> = [];
  for (const item of index[collection] ?? []) {
    const alsoCalled = kind === 'person' ? ((item as PersonIndexItem).alsoCalled ?? []) : [];
    const tier = matchTier([item.name, ...alsoCalled], query);
    if (tier !== undefined) matches.push({ item, tier });
  }
  matches.sort((a, b) => a.tier - b.tier || (b.item.numberOfReferences ?? 0) - (a.item.numberOfReferences ?? 0));
  return matches.slice(0, options.limit ?? 10).map((match) => match.item);
}

/** The History Globe place index. */
export async function loadHistoryGlobeIndex(client: BibleApiClient): Promise<HistoryGlobePlaceItem[]> {
  return (await client.datasetIndex<{ places: HistoryGlobePlaceItem[] }>(HISTORY_GLOBE, 'places')).places;
}

/** A History Globe place by id, with its verse references. */
export async function getHistoryGlobePlace(client: BibleApiClient, id: string): Promise<HistoryGlobePlace> {
  return (await client.datasetEntity<{ place: HistoryGlobePlace }>(HISTORY_GLOBE, 'places', id)).place;
}

/** Great-circle distance in kilometres. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * The History Globe place with this normalized name. Among namesakes the nearest to
 * the given coordinates wins; without coordinates, the best attested.
 */
export function matchHistoryGlobePlace(
  places: readonly HistoryGlobePlaceItem[],
  name: string,
  latitude?: number,
  longitude?: number,
): HistoryGlobePlaceItem | undefined {
  const query = normalizeName(name);
  const candidates = places.filter((place) => normalizeName(place.name) === query);
  if (latitude === undefined || longitude === undefined) {
    return candidates.sort((a, b) => (b.numberOfReferences ?? 0) - (a.numberOfReferences ?? 0))[0];
  }
  const distance = (place: HistoryGlobePlaceItem) => distanceKm(latitude, longitude, place.latitude, place.longitude);
  return candidates.sort((a, b) => distance(a) - distance(b))[0];
}

export async function findHistoryGlobePlace(
  client: BibleApiClient,
  name: string,
  latitude?: number,
  longitude?: number,
): Promise<HistoryGlobePlaceItem | undefined> {
  return matchHistoryGlobePlace(await loadHistoryGlobeIndex(client), name, latitude, longitude);
}

/** "0046" -> 46, "-01085" -> -1085, "0047-05-01" -> 47; `undefined` when it is not a year. */
export function parseYear(startDate: string | undefined): number | undefined {
  const match = /^(-?)(\d{1,5})(?:-\d{2}(?:-\d{2})?)?$/.exec((startDate ?? '').trim());
  if (!match) return undefined;
  const year = Number(match[2]);
  return match[1] ? -year : year;
}

/** Spanish style: 46 -> "46 d.C.", -1085 -> "1085 a.C.". */
export function formatYear(year: number): string {
  return year < 0 ? `${-year} a.C.` : `${year} d.C.`;
}

/** The passage a dataset reference points to; `undefined` for an unknown book. */
export function passageRefOf(ref: BibleRef): PassageRef | undefined {
  const book = findBook(ref.book);
  if (!book) return undefined;
  return { book: book.id, startChapter: ref.chapter, startVerse: ref.verse, endChapter: ref.chapter, endVerse: ref.endVerse ?? ref.verse };
}

/** "Hechos 16:12", or the raw coordinates when the book is unknown. */
export function formatBibleRef(ref: BibleRef): string {
  const passage = passageRefOf(ref);
  if (passage) return formatReference(passage);
  return `${ref.book} ${ref.chapter}:${ref.verse}${ref.endVerse && ref.endVerse !== ref.verse ? `-${ref.endVerse}` : ''}`;
}
