import { findBook } from './books.js';
import { chaptersOf, containsVerse, formatReference } from './reference.js';
import { readChapter } from './text.js';
/** Text of a passage in one translation, verse by verse. */
export async function getPassage(client, translation, ref) {
    const verses = [];
    const headings = [];
    let info = { id: translation, name: translation };
    for (const chapter of chaptersOf(ref)) {
        const data = await client.chapter(translation, ref.book, chapter);
        info = { id: data.translation.id, name: data.translation.name, shortName: data.translation.shortName };
        const read = readChapter(data.chapter.content);
        for (const v of read.verses) {
            if (containsVerse(ref, chapter, v.verse))
                verses.push({ chapter, verse: v.verse, text: v.text });
        }
        for (const h of read.headings) {
            if (containsVerse(ref, chapter, h.beforeVerse))
                headings.push({ chapter, ...h });
        }
    }
    return { ref, reference: formatReference(ref), translation: info, verses, headings };
}
/**
 * Notes of one commentary for a passage, plus the introduction of each chapter
 * spanned. Commentaries that annotate by section key a note to its first verse,
 * so when no note starts on the passage's first verse, the closest earlier note
 * in that chapter (the section covering it) is included first. `undefined` when
 * the commentary covers none of those chapters.
 */
export async function getCommentary(client, commentary, ref) {
    const result = { commentary: { id: commentary, name: commentary }, introductions: [], notes: [] };
    let found = false;
    for (const chapter of chaptersOf(ref)) {
        const data = await client.tryCommentaryChapter(commentary, ref.book, chapter);
        if (!data)
            continue;
        found = true;
        if (data.commentary)
            result.commentary = { id: data.commentary.id, name: data.commentary.name };
        if (data.chapter.introduction)
            result.introductions.push({ chapter, text: data.chapter.introduction });
        const entries = data.chapter.content.filter((entry) => entry.type === 'verse');
        const firstVerse = chapter === ref.startChapter ? ref.startVerse : undefined;
        if (firstVerse !== undefined && !entries.some((entry) => entry.number === firstVerse)) {
            const covering = entries.filter((entry) => entry.number < firstVerse).at(-1);
            if (covering)
                result.notes.push({ chapter, verse: covering.number, text: covering.content.join('\n') });
        }
        for (const entry of entries) {
            if (containsVerse(ref, chapter, entry.number)) {
                result.notes.push({ chapter, verse: entry.number, text: entry.content.join('\n') });
            }
        }
    }
    return found ? result : undefined;
}
/** Cross references from every verse of the passage (open-cross-ref dataset), strongest first per verse. */
export async function getCrossReferences(client, ref, options = {}) {
    const minScore = options.minScore ?? 0;
    const limit = options.limitPerVerse ?? 10;
    const result = [];
    for (const chapter of chaptersOf(ref)) {
        const data = await client.crossReferences(ref.book, chapter);
        for (const entry of data.chapter.content) {
            if (!containsVerse(ref, chapter, entry.verse))
                continue;
            const links = entry.references
                .filter((target) => findBook(target.book) !== undefined && (target.score ?? 0) >= minScore)
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .slice(0, limit);
            for (const target of links) {
                const to = {
                    book: target.book,
                    startChapter: target.chapter,
                    startVerse: target.verse,
                    endChapter: target.endChapter ?? target.chapter,
                    endVerse: target.endVerse ?? target.verse,
                };
                result.push({ from: { chapter, verse: entry.verse }, to, reference: formatReference(to), score: target.score ?? 0 });
            }
        }
    }
    return result;
}
