import { getBook } from './books.js';
import { chaptersOf, containsVerse, formatReference } from './reference.js';
export const INTERLINEAR_DATASET = 'bsb-interlinear';
export const LEXICON_DATASET = 'stepbible-lexicon';
const STRONGS = /^([GH])0*(\d{1,4})([A-Z]?)$/;
/** "G25", "g0025" -> "G0025"; "H157" -> "H0157"; an optional letter suffix ("G2316G") is kept uppercase. */
export function normalizeStrongs(input) {
    const match = STRONGS.exec(input.trim().toUpperCase());
    if (!match || Number(match[2]) === 0) {
        throw new Error(`Invalid Strong's number "${input}": expected G or H followed by up to four digits, e.g. "G25" or "H2617".`);
    }
    return `${match[1]}${match[2].padStart(4, '0')}${match[3]}`;
}
/** A Strong's number without its letter suffix, or `undefined` when the word carries none. */
function baseStrongs(value) {
    try {
        return normalizeStrongs(value).slice(0, 5);
    }
    catch {
        return undefined;
    }
}
/** Interlinear words of every verse in the passage. A chapter the dataset lacks is skipped. */
export async function getInterlinear(client, ref) {
    const result = [];
    for (const chapter of chaptersOf(ref)) {
        const data = await client.tryDatasetChapter(INTERLINEAR_DATASET, ref.book, chapter);
        if (!data)
            continue;
        for (const entry of data.chapter.content) {
            if (containsVerse(ref, chapter, entry.verse))
                result.push({ chapter, verse: entry.verse, words: entry.words });
        }
    }
    return result;
}
/** STEPBible Brief Lexicon entry; the suffixed id ("G2316G") falls back to the plain one. `undefined` when absent. */
export async function getLexiconEntry(client, strongs) {
    const id = normalizeStrongs(strongs);
    const ids = id.length > 5 ? [id, id.slice(0, 5)] : [id];
    for (const candidate of ids) {
        const data = await client.tryLexiconEntry(LEXICON_DATASET, candidate);
        if (data)
            return data.entry;
    }
    return undefined;
}
/** Chapters fetched at once while scanning; results are still read in canonical order. */
const SCAN_BATCH = 8;
/**
 * Counts the words of the given books whose Strong's number equals the target (ignoring any
 * letter suffix), scanning the interlinear chapters in canonical order. Chapters the dataset
 * lacks are skipped, so the counts cover only what was scanned.
 */
export async function findOccurrences(client, strongs, books, options) {
    const target = normalizeStrongs(strongs).slice(0, 5);
    const result = { total: 0, byBook: {}, glosses: [], samples: [] };
    const glossCounts = new Map();
    const chapters = [];
    for (const id of books) {
        const range = options.within && options.within.book === id ? chaptersOf(options.within) : undefined;
        if (options.within && !range)
            continue;
        for (const chapter of range ?? Array.from({ length: getBook(id).chapters }, (_, i) => i + 1)) {
            chapters.push({ book: id, chapter });
        }
    }
    for (let start = 0; start < chapters.length; start += SCAN_BATCH) {
        const batch = chapters.slice(start, start + SCAN_BATCH);
        const loaded = await Promise.all(batch.map(({ book, chapter }) => client.tryDatasetChapter(INTERLINEAR_DATASET, book, chapter)));
        loaded.forEach((data, index) => {
            if (!data)
                return;
            const { book, chapter } = batch[index];
            for (const entry of data.chapter.content) {
                if (options.within && !containsVerse(options.within, chapter, entry.verse))
                    continue;
                for (const word of entry.words) {
                    if (baseStrongs(word.strongs) !== target)
                        continue;
                    result.total++;
                    result.byBook[book] = (result.byBook[book] ?? 0) + 1;
                    if (word.gloss)
                        glossCounts.set(word.gloss, (glossCounts.get(word.gloss) ?? 0) + 1);
                    if (result.samples.length < options.max) {
                        const ref = { book, startChapter: chapter, startVerse: entry.verse, endChapter: chapter, endVerse: entry.verse };
                        result.samples.push({
                            ref,
                            reference: formatReference(ref),
                            text: word.text,
                            transliteration: word.transliteration,
                            parsing: word.parsing,
                            gloss: word.gloss,
                        });
                    }
                }
            }
        });
    }
    result.glosses = [...glossCounts].map(([gloss, count]) => ({ gloss, count })).sort((a, b) => b.count - a.count);
    return result;
}
