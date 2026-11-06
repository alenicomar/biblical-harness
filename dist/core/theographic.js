import { findBook } from './books.js';
import { chaptersOf, containsVerse, formatReference } from './reference.js';
export const THEOGRAPHIC = 'theographic';
export const HISTORY_GLOBE = 'history-globe';
/** Directory (and index file) name of each entity kind in the dataset. */
const COLLECTION = { person: 'people', place: 'places', event: 'events', group: 'groups' };
/**
 * People, places and events whose verses intersect the passage, across all of its
 * chapters. An entity listed in several chapters is merged by id; only the verses
 * inside the passage are kept. Chapters the dataset does not cover are skipped.
 */
export async function getPassageEntities(client, ref) {
    const found = { people: [], places: [], events: [] };
    for (const chapter of chaptersOf(ref)) {
        const data = await client.tryDatasetChapter(THEOGRAPHIC, ref.book, chapter);
        if (!data)
            continue;
        mergeInto(found.people, data.chapter.people, ref, chapter);
        mergeInto(found.places, data.chapter.places, ref, chapter);
        mergeInto(found.events, data.chapter.events, ref, chapter);
    }
    return found;
}
function mergeInto(into, items, ref, chapter) {
    for (const item of items ?? []) {
        const verses = item.verses.filter((verse) => containsVerse(ref, chapter, verse)).map((verse) => ({ chapter, verse }));
        if (verses.length === 0)
            continue;
        const known = into.find((entry) => entry.id === item.id);
        if (known)
            known.verses.push(...verses);
        else
            into.push({ ...item, verses });
    }
}
export async function getPerson(client, id) {
    return (await client.datasetEntity(THEOGRAPHIC, COLLECTION.person, id)).person;
}
export async function getPlace(client, id) {
    return (await client.datasetEntity(THEOGRAPHIC, COLLECTION.place, id)).place;
}
export async function getEvent(client, id) {
    return (await client.datasetEntity(THEOGRAPHIC, COLLECTION.event, id)).event;
}
export async function getGroup(client, id) {
    return (await client.datasetEntity(THEOGRAPHIC, COLLECTION.group, id)).group;
}
/** Lowercase, diacritics stripped, whitespace collapsed: "  José  " -> "jose". */
export function normalizeName(name) {
    return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}
/** 0 exact, 1 prefix, 2 substring, undefined when no name matches. */
function matchTier(names, query) {
    let best;
    for (const name of names) {
        const normalized = normalizeName(name);
        const tier = normalized === query ? 0 : normalized.startsWith(query) ? 1 : normalized.includes(query) ? 2 : undefined;
        if (tier !== undefined && (best === undefined || tier < best))
            best = tier;
    }
    return best;
}
/**
 * Index items of one kind whose name matches, accent- and case-insensitively: exact
 * matches first, then prefix, then substring; ties by number of references, most
 * attested first. People also match `alsoCalled` when the index carries it.
 */
export async function searchEntities(client, kind, name, options = {}) {
    const query = normalizeName(name);
    if (query === '')
        return [];
    const collection = COLLECTION[kind];
    const index = await client.datasetIndex(THEOGRAPHIC, collection);
    const matches = [];
    for (const item of index[collection] ?? []) {
        const alsoCalled = kind === 'person' ? (item.alsoCalled ?? []) : [];
        const tier = matchTier([item.name, ...alsoCalled], query);
        if (tier !== undefined)
            matches.push({ item, tier });
    }
    matches.sort((a, b) => a.tier - b.tier || (b.item.numberOfReferences ?? 0) - (a.item.numberOfReferences ?? 0));
    return matches.slice(0, options.limit ?? 10).map((match) => match.item);
}
/** The History Globe place index. */
export async function loadHistoryGlobeIndex(client) {
    return (await client.datasetIndex(HISTORY_GLOBE, 'places')).places;
}
/** A History Globe place by id, with its verse references. */
export async function getHistoryGlobePlace(client, id) {
    return (await client.datasetEntity(HISTORY_GLOBE, 'places', id)).place;
}
/** Great-circle distance in kilometres. */
export function distanceKm(lat1, lon1, lat2, lon2) {
    const rad = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
        Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
/**
 * The History Globe place with this normalized name. Among namesakes the nearest to
 * the given coordinates wins; without coordinates, the best attested.
 */
export function matchHistoryGlobePlace(places, name, latitude, longitude) {
    const query = normalizeName(name);
    const candidates = places.filter((place) => normalizeName(place.name) === query);
    if (latitude === undefined || longitude === undefined) {
        return candidates.sort((a, b) => (b.numberOfReferences ?? 0) - (a.numberOfReferences ?? 0))[0];
    }
    const distance = (place) => distanceKm(latitude, longitude, place.latitude, place.longitude);
    return candidates.sort((a, b) => distance(a) - distance(b))[0];
}
export async function findHistoryGlobePlace(client, name, latitude, longitude) {
    return matchHistoryGlobePlace(await loadHistoryGlobeIndex(client), name, latitude, longitude);
}
/** "0046" -> 46, "-01085" -> -1085, "0047-05-01" -> 47; `undefined` when it is not a year. */
export function parseYear(startDate) {
    const match = /^(-?)(\d{1,5})(?:-\d{2}(?:-\d{2})?)?$/.exec((startDate ?? '').trim());
    if (!match)
        return undefined;
    const year = Number(match[2]);
    return match[1] ? -year : year;
}
/** Spanish style: 46 -> "46 d.C.", -1085 -> "1085 a.C.". */
export function formatYear(year) {
    return year < 0 ? `${-year} a.C.` : `${year} d.C.`;
}
/** The passage a dataset reference points to; `undefined` for an unknown book. */
export function passageRefOf(ref) {
    const book = findBook(ref.book);
    if (!book)
        return undefined;
    return { book: book.id, startChapter: ref.chapter, startVerse: ref.verse, endChapter: ref.chapter, endVerse: ref.endVerse ?? ref.verse };
}
/** "Hechos 16:12", or the raw coordinates when the book is unknown. */
export function formatBibleRef(ref) {
    const passage = passageRefOf(ref);
    if (passage)
        return formatReference(passage);
    return `${ref.book} ${ref.chapter}:${ref.verse}${ref.endVerse && ref.endVerse !== ref.verse ? `-${ref.endVerse}` : ''}`;
}
