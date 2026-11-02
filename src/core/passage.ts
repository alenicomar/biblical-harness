import { findBook } from './books.ts';
import type { BibleApiClient } from './client.ts';
import { chaptersOf, containsVerse, formatReference, type PassageRef } from './reference.ts';
import { readChapter } from './text.ts';

export interface VerseLocation {
  chapter: number;
  verse: number;
}

export interface PassageVerse extends VerseLocation {
  text: string;
}

export interface Passage {
  ref: PassageRef;
  reference: string;
  translation: { id: string; name: string; shortName?: string };
  verses: PassageVerse[];
  headings: Array<{ chapter: number; beforeVerse: number; text: string }>;
}

/** Text of a passage in one translation, verse by verse. */
export async function getPassage(client: BibleApiClient, translation: string, ref: PassageRef): Promise<Passage> {
  const verses: PassageVerse[] = [];
  const headings: Passage['headings'] = [];
  let info: Passage['translation'] = { id: translation, name: translation };

  for (const chapter of chaptersOf(ref)) {
    const data = await client.chapter(translation, ref.book, chapter);
    info = { id: data.translation.id, name: data.translation.name, shortName: data.translation.shortName };
    const read = readChapter(data.chapter.content);
    for (const v of read.verses) {
      if (containsVerse(ref, chapter, v.verse)) verses.push({ chapter, verse: v.verse, text: v.text });
    }
    for (const h of read.headings) {
      if (containsVerse(ref, chapter, h.beforeVerse)) headings.push({ chapter, ...h });
    }
  }
  return { ref, reference: formatReference(ref), translation: info, verses, headings };
}

export interface CommentaryExcerpt {
  commentary: { id: string; name: string };
  introductions: Array<{ chapter: number; text: string }>;
  notes: PassageVerse[];
}

/**
 * Notes of one commentary for a passage, plus the introduction of each chapter
 * spanned. Commentaries that annotate by section key a note to its first verse,
 * so when no note starts on the passage's first verse, the closest earlier note
 * in that chapter (the section covering it) is included first. `undefined` when
 * the commentary covers none of those chapters.
 */
export async function getCommentary(
  client: BibleApiClient,
  commentary: string,
  ref: PassageRef,
): Promise<CommentaryExcerpt | undefined> {
  const result: CommentaryExcerpt = { commentary: { id: commentary, name: commentary }, introductions: [], notes: [] };
  let found = false;

  for (const chapter of chaptersOf(ref)) {
    const data = await client.tryCommentaryChapter(commentary, ref.book, chapter);
    if (!data) continue;
    found = true;
    if (data.commentary) result.commentary = { id: data.commentary.id, name: data.commentary.name };
    if (data.chapter.introduction) result.introductions.push({ chapter, text: data.chapter.introduction });
    const entries = data.chapter.content.filter((entry) => entry.type === 'verse');
    const firstVerse = chapter === ref.startChapter ? ref.startVerse : undefined;
    if (firstVerse !== undefined && !entries.some((entry) => entry.number === firstVerse)) {
      const covering = entries.filter((entry) => entry.number < firstVerse).at(-1);
      if (covering) result.notes.push({ chapter, verse: covering.number, text: covering.content.join('\n') });
    }
    for (const entry of entries) {
      if (containsVerse(ref, chapter, entry.number)) {
        result.notes.push({ chapter, verse: entry.number, text: entry.content.join('\n') });
      }
    }
  }
  return found ? result : undefined;
}

export interface CrossReference {
  from: VerseLocation;
  to: PassageRef;
  reference: string;
  score: number;
}

export interface CrossReferenceOptions {
  /** Drop links whose OpenBible vote score is below this. Default 0. */
  minScore?: number;
  /** Keep at most this many links per source verse, highest score first. Default 10. */
  limitPerVerse?: number;
}

/** Cross references from every verse of the passage (open-cross-ref dataset), strongest first per verse. */
export async function getCrossReferences(
  client: BibleApiClient,
  ref: PassageRef,
  options: CrossReferenceOptions = {},
): Promise<CrossReference[]> {
  const minScore = options.minScore ?? 0;
  const limit = options.limitPerVerse ?? 10;
  const result: CrossReference[] = [];

  for (const chapter of chaptersOf(ref)) {
    const data = await client.crossReferences(ref.book, chapter);
    for (const entry of data.chapter.content) {
      if (!containsVerse(ref, chapter, entry.verse)) continue;
      const links = entry.references
        .filter((target) => findBook(target.book) !== undefined && (target.score ?? 0) >= minScore)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, limit);
      for (const target of links) {
        const to: PassageRef = {
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
