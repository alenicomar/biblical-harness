import { findBook, getBook } from './books.ts';

/**
 * A contiguous passage. Verses are omitted for whole-chapter references
 * ("Sal 23", "Sal 23-24"); otherwise both ends carry a verse.
 */
export interface PassageRef {
  book: string;
  startChapter: number;
  startVerse?: number;
  endChapter: number;
  endVerse?: number;
}

export class ReferenceParseError extends Error {
  constructor(input: string, reason: string) {
    super(`Cannot parse reference "${input}": ${reason}`);
    this.name = 'ReferenceParseError';
  }
}

// book, chapter, optional [:.,]verse, optional -(chapter[:.,]verse | number)
const PATTERN = /^(.+?)\s*(\d+)(?:\s*[:.,]\s*(\d+))?(?:\s*[-–—]\s*(\d+)(?:\s*[:.,]\s*(\d+))?)?$/;

export function parseReference(input: string): PassageRef {
  const text = input.trim();
  const match = PATTERN.exec(text);
  if (!match) throw new ReferenceParseError(input, 'expected "<book> <chapter>[:<verse>][-<end>]"');

  const [, bookText = '', a, b, c, d] = match;
  const book = findBook(bookText);
  if (!book) throw new ReferenceParseError(input, `unknown book "${bookText.trim()}"`);

  const n = (value: string | undefined) => (value === undefined ? undefined : Number(value));
  let ref: PassageRef;

  if (book.chapters === 1 && b === undefined && d === undefined) {
    // "Judas 3" / "Flm 4-7": a bare number in a one-chapter book is a verse.
    const verse = n(a)!;
    ref = { book: book.id, startChapter: 1, startVerse: verse, endChapter: 1, endVerse: n(c) ?? verse };
  } else if (b === undefined) {
    if (d !== undefined) throw new ReferenceParseError(input, 'a range ending in a verse needs a starting verse');
    // "Sal 23" or "Sal 23-24"
    ref = { book: book.id, startChapter: n(a)!, endChapter: n(c) ?? n(a)! };
  } else if (d !== undefined) {
    // "Gn 1:1-2:3"
    ref = { book: book.id, startChapter: n(a)!, startVerse: n(b)!, endChapter: n(c)!, endVerse: n(d)! };
  } else {
    // "Jn 3:16" or "Jn 3:16-18"
    ref = { book: book.id, startChapter: n(a)!, startVerse: n(b)!, endChapter: n(a)!, endVerse: n(c) ?? n(b)! };
  }

  validate(input, ref);
  return ref;
}

/** Parses several references separated by semicolons: "Jn 3:16; 1 Jn 4:8". */
export function parseReferences(input: string): PassageRef[] {
  return input
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseReference);
}

function validate(input: string, ref: PassageRef): void {
  const book = getBook(ref.book);
  for (const chapter of [ref.startChapter, ref.endChapter]) {
    if (chapter < 1 || chapter > book.chapters) {
      throw new ReferenceParseError(input, `chapter ${chapter} is out of range for ${book.id} (1-${book.chapters})`);
    }
  }
  if (ref.startVerse !== undefined && ref.startVerse < 1) {
    throw new ReferenceParseError(input, 'verses start at 1');
  }
  const startsAfterEnd =
    ref.endChapter < ref.startChapter ||
    (ref.endChapter === ref.startChapter && (ref.endVerse ?? 0) < (ref.startVerse ?? 0));
  if (startsAfterEnd) throw new ReferenceParseError(input, 'the range ends before it starts');
}

/** True when the verse falls inside the passage. */
export function containsVerse(ref: PassageRef, chapter: number, verse: number): boolean {
  if (chapter < ref.startChapter || chapter > ref.endChapter) return false;
  if (chapter === ref.startChapter && ref.startVerse !== undefined && verse < ref.startVerse) return false;
  if (chapter === ref.endChapter && ref.endVerse !== undefined && verse > ref.endVerse) return false;
  return true;
}

/** Chapters the passage spans, in order. */
export function chaptersOf(ref: PassageRef): number[] {
  const chapters: number[] = [];
  for (let chapter = ref.startChapter; chapter <= ref.endChapter; chapter++) chapters.push(chapter);
  return chapters;
}

export function formatReference(ref: PassageRef, lang: 'es' | 'en' = 'es'): string {
  const book = getBook(ref.book);
  const name = lang === 'es' ? book.es : book.en;
  const oneChapterBook = book.chapters === 1;

  if (ref.startVerse === undefined) {
    const range = ref.endChapter === ref.startChapter ? `${ref.startChapter}` : `${ref.startChapter}-${ref.endChapter}`;
    return `${name} ${range}`;
  }
  const start = oneChapterBook ? `${ref.startVerse}` : `${ref.startChapter}:${ref.startVerse}`;
  if (ref.endChapter !== ref.startChapter) return `${name} ${start}-${ref.endChapter}:${ref.endVerse}`;
  if (ref.endVerse === ref.startVerse) return `${name} ${start}`;
  return `${name} ${start}-${ref.endVerse}`;
}
