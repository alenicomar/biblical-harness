import type { ChapterContent, VerseContentItem } from './types.ts';

/** Plain text of a verse: footnote markers and inline headings dropped, line breaks become spaces. */
export function verseText(items: readonly VerseContentItem[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (typeof item === 'string') parts.push(item);
    else if ('text' in item) parts.push(item.text);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export interface ChapterVerse {
  verse: number;
  text: string;
}

export interface ChapterHeading {
  beforeVerse: number;
  text: string;
}

/** Splits chapter content into verses and section headings (attached to the verse they precede). */
export function readChapter(content: readonly ChapterContent[]): { verses: ChapterVerse[]; headings: ChapterHeading[] } {
  const verses: ChapterVerse[] = [];
  const headings: ChapterHeading[] = [];
  const pending: string[] = [];

  for (const item of content) {
    if (item.type === 'heading') {
      pending.push(item.content.join(' ').trim());
    } else if (item.type === 'verse') {
      for (const text of pending.splice(0)) headings.push({ beforeVerse: item.number, text });
      for (const inline of item.content) {
        if (typeof inline !== 'string' && 'heading' in inline) {
          headings.push({ beforeVerse: item.number, text: inline.heading });
        }
      }
      verses.push({ verse: item.number, text: verseText(item.content) });
    }
  }
  return { verses, headings };
}
