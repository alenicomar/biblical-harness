/**
 * Response shapes of the Free Use Bible API (https://bible.helloao.org/docs/).
 * Only the fields this project reads are typed; the API returns more.
 */

export interface TranslationLicense {
  attribution?: string;
  commercialUse?: string;
  derivatives?: string;
  copyleft?: boolean;
  publicDomain?: boolean;
}

export interface Translation {
  id: string;
  name: string;
  englishName?: string;
  shortName?: string;
  language?: string;
  textDirection?: 'ltr' | 'rtl';
  website?: string;
  licenseUrl?: string;
  license?: TranslationLicense;
  numberOfBooks?: number;
}

export interface TranslationBook {
  id: string;
  name: string;
  commonName?: string;
  order: number;
  numberOfChapters: number;
  totalNumberOfVerses?: number;
}

export interface FormattedText {
  text: string;
  poem?: number;
  wordsOfJesus?: boolean;
}

export interface InlineHeading {
  heading: string;
}

export interface InlineLineBreak {
  lineBreak: true;
  paragraph?: string;
}

export interface VerseFootnoteReference {
  noteId: number;
}

export type VerseContentItem = string | FormattedText | InlineHeading | InlineLineBreak | VerseFootnoteReference;

export type ChapterContent =
  | { type: 'heading'; content: string[] }
  | { type: 'line_break'; paragraph?: string }
  | { type: 'verse'; number: number; content: VerseContentItem[] }
  | { type: 'hebrew_subtitle'; content: Array<string | FormattedText | VerseFootnoteReference> };

export interface ChapterFootnote {
  noteId: number;
  text: string;
  reference?: { chapter: number; verse: number };
  caller: string | null;
}

export interface TranslationChapter {
  translation: Translation;
  book: TranslationBook;
  chapter: { number: number; content: ChapterContent[]; footnotes: ChapterFootnote[] };
  numberOfVerses?: number;
}

export interface Commentary {
  id: string;
  name: string;
  englishName?: string;
  language?: string;
  website?: string;
  licenseUrl?: string;
}

export interface CommentaryChapter {
  commentary: Commentary;
  book: { id: string; name: string };
  chapter: {
    number: number;
    introduction?: string;
    content: Array<{ type: 'verse'; number: number; content: string[] }>;
  };
}

export interface Dataset {
  id: string;
  name: string;
  licenseUrl?: string;
  licenseNotes?: string;
}

export interface CrossReferenceTarget {
  book: string;
  chapter: number;
  verse: number;
  endChapter?: number;
  endVerse?: number;
  score?: number;
}

export interface CrossReferenceChapter {
  dataset?: Dataset;
  chapter: {
    number: number;
    content: Array<{ verse: number; references: CrossReferenceTarget[] }>;
  };
}
