/**
 * The 66-book Protestant canon, keyed by the USFM-style ids the Free Use
 * Bible API uses (`GEN`, `1CO`, `JHN`...). Deuterocanonical books are left out
 * on purpose: this ecosystem follows the Protestant canon.
 */

export type Testament = 'OT' | 'NT';

export interface Book {
  id: string;
  order: number;
  testament: Testament;
  chapters: number;
  /** Canonical Spanish name. */
  es: string;
  /** Canonical English name. */
  en: string;
  /** Extra names and abbreviations; canonical names and the id are added automatically. */
  aliases: readonly string[];
}

type BookRow = [id: string, chapters: number, es: string, en: string, aliases: string[]];

const ROWS: BookRow[] = [
  ['GEN', 50, 'Génesis', 'Genesis', ['Gn', 'Gén', 'Gen', 'Ge']],
  ['EXO', 40, 'Éxodo', 'Exodus', ['Éx', 'Ex', 'Exo', 'Exod']],
  ['LEV', 27, 'Levítico', 'Leviticus', ['Lv', 'Lev']],
  ['NUM', 36, 'Números', 'Numbers', ['Nm', 'Núm', 'Num', 'Nu']],
  ['DEU', 34, 'Deuteronomio', 'Deuteronomy', ['Dt', 'Deut', 'Deu']],
  ['JOS', 24, 'Josué', 'Joshua', ['Jos', 'Josh']],
  ['JDG', 21, 'Jueces', 'Judges', ['Jue', 'Jc', 'Judg', 'Jdg']],
  ['RUT', 4, 'Rut', 'Ruth', ['Rt', 'Ru']],
  ['1SA', 31, '1 Samuel', '1 Samuel', ['1 S', '1 Sam', '1 Sa', '1 Sm']],
  ['2SA', 24, '2 Samuel', '2 Samuel', ['2 S', '2 Sam', '2 Sa', '2 Sm']],
  ['1KI', 22, '1 Reyes', '1 Kings', ['1 R', '1 Re', '1 Rey', '1 Ki', '1 Kgs']],
  ['2KI', 25, '2 Reyes', '2 Kings', ['2 R', '2 Re', '2 Rey', '2 Ki', '2 Kgs']],
  ['1CH', 29, '1 Crónicas', '1 Chronicles', ['1 Cr', '1 Cro', '1 Crón', '1 Ch', '1 Chr', '1 Chron']],
  ['2CH', 36, '2 Crónicas', '2 Chronicles', ['2 Cr', '2 Cro', '2 Crón', '2 Ch', '2 Chr', '2 Chron']],
  ['EZR', 10, 'Esdras', 'Ezra', ['Esd', 'Ezr']],
  ['NEH', 13, 'Nehemías', 'Nehemiah', ['Neh', 'Ne']],
  ['EST', 10, 'Ester', 'Esther', ['Est']],
  ['JOB', 42, 'Job', 'Job', ['Jb']],
  ['PSA', 150, 'Salmos', 'Psalms', ['Salmo', 'Psalm', 'Sal', 'Sl', 'Ps', 'Psa']],
  ['PRO', 31, 'Proverbios', 'Proverbs', ['Pr', 'Pro', 'Prov', 'Prv']],
  ['ECC', 12, 'Eclesiastés', 'Ecclesiastes', ['Ec', 'Ecl', 'Ecc', 'Eccl', 'Qohelet']],
  ['SNG', 8, 'Cantar de los Cantares', 'Song of Songs', ['Cantares', 'Song of Solomon', 'Cnt', 'Cant', 'Ct', 'Song', 'Sng']],
  ['ISA', 66, 'Isaías', 'Isaiah', ['Is', 'Isa']],
  ['JER', 52, 'Jeremías', 'Jeremiah', ['Jr', 'Jer']],
  ['LAM', 5, 'Lamentaciones', 'Lamentations', ['Lm', 'Lam']],
  ['EZK', 48, 'Ezequiel', 'Ezekiel', ['Ez', 'Eze', 'Ezek', 'Ezq']],
  ['DAN', 12, 'Daniel', 'Daniel', ['Dn', 'Dan', 'Da']],
  ['HOS', 14, 'Oseas', 'Hosea', ['Os', 'Hos']],
  ['JOL', 3, 'Joel', 'Joel', ['Jl', 'Joe']],
  ['AMO', 9, 'Amós', 'Amos', ['Am']],
  ['OBA', 1, 'Abdías', 'Obadiah', ['Abd', 'Ab', 'Obad', 'Ob']],
  ['JON', 4, 'Jonás', 'Jonah', ['Jon']],
  ['MIC', 7, 'Miqueas', 'Micah', ['Mi', 'Miq', 'Mic']],
  ['NAM', 3, 'Nahúm', 'Nahum', ['Nah', 'Na']],
  ['HAB', 3, 'Habacuc', 'Habakkuk', ['Hab', 'Ha']],
  ['ZEP', 3, 'Sofonías', 'Zephaniah', ['Sof', 'So', 'Zeph', 'Zep']],
  ['HAG', 2, 'Hageo', 'Haggai', ['Hag', 'Ag']],
  ['ZEC', 14, 'Zacarías', 'Zechariah', ['Zac', 'Za', 'Zech', 'Zec']],
  ['MAL', 4, 'Malaquías', 'Malachi', ['Mal', 'Ml']],
  ['MAT', 28, 'Mateo', 'Matthew', ['San Mateo', 'Mt', 'Mat', 'Matt']],
  ['MRK', 16, 'Marcos', 'Mark', ['San Marcos', 'Mr', 'Mc', 'Mrc', 'Mk', 'Mar']],
  ['LUK', 24, 'Lucas', 'Luke', ['San Lucas', 'Lc', 'Luc', 'Lk', 'Lu']],
  ['JHN', 21, 'Juan', 'John', ['San Juan', 'Jn', 'Jua']],
  ['ACT', 28, 'Hechos', 'Acts', ['Hch', 'Hech', 'Hc', 'Ac', 'Act']],
  ['ROM', 16, 'Romanos', 'Romans', ['Ro', 'Rom', 'Rm']],
  ['1CO', 16, '1 Corintios', '1 Corinthians', ['1 Co', '1 Cor']],
  ['2CO', 13, '2 Corintios', '2 Corinthians', ['2 Co', '2 Cor']],
  ['GAL', 6, 'Gálatas', 'Galatians', ['Gá', 'Gál', 'Ga', 'Gal']],
  ['EPH', 6, 'Efesios', 'Ephesians', ['Ef', 'Efe', 'Eph']],
  ['PHP', 4, 'Filipenses', 'Philippians', ['Fil', 'Flp', 'Php', 'Phil']],
  ['COL', 4, 'Colosenses', 'Colossians', ['Col']],
  ['1TH', 5, '1 Tesalonicenses', '1 Thessalonians', ['1 Ts', '1 Tes', '1 Th', '1 Thess']],
  ['2TH', 3, '2 Tesalonicenses', '2 Thessalonians', ['2 Ts', '2 Tes', '2 Th', '2 Thess']],
  ['1TI', 6, '1 Timoteo', '1 Timothy', ['1 Ti', '1 Tim']],
  ['2TI', 4, '2 Timoteo', '2 Timothy', ['2 Ti', '2 Tim']],
  ['TIT', 3, 'Tito', 'Titus', ['Tit']],
  ['PHM', 1, 'Filemón', 'Philemon', ['Flm', 'Filem', 'Phm', 'Phlm']],
  ['HEB', 13, 'Hebreos', 'Hebrews', ['He', 'Heb']],
  ['JAS', 5, 'Santiago', 'James', ['Stg', 'Sant', 'Stgo', 'Jas']],
  ['1PE', 5, '1 Pedro', '1 Peter', ['1 P', '1 Pe', '1 Ped', '1 Pet']],
  ['2PE', 3, '2 Pedro', '2 Peter', ['2 P', '2 Pe', '2 Ped', '2 Pet']],
  ['1JN', 5, '1 Juan', '1 John', ['1 Jn', '1 Jua']],
  ['2JN', 1, '2 Juan', '2 John', ['2 Jn', '2 Jua']],
  ['3JN', 1, '3 Juan', '3 John', ['3 Jn', '3 Jua']],
  ['JUD', 1, 'Judas', 'Jude', ['Jud', 'Jds']],
  ['REV', 22, 'Apocalipsis', 'Revelation', ['Ap', 'Apoc', 'Rev', 'Rv']],
];

export const BOOKS: readonly Book[] = ROWS.map(([id, chapters, es, en, aliases], index) => ({
  id,
  order: index + 1,
  testament: index < 39 ? 'OT' : 'NT',
  chapters,
  es,
  en,
  aliases,
}));

const ORDINAL_PREFIXES: Array<[RegExp, string]> = [
  [/^(primera|primero|primer|1ra|1ro|1era|1a|1o|i)\s+(de\s+)?/, '1'],
  [/^(segunda|segundo|2da|2do|2a|2o|ii)\s+(de\s+)?/, '2'],
  [/^(tercera|tercero|3ra|3ro|3era|3a|3o|iii)\s+(de\s+)?/, '3'],
  [/^([123])\s+de\s+/, '$1'],
];

/** Lowercases, strips diacritics, ordinal words, dots and whitespace: "Primera de Corintios" -> "1corintios". */
export function normalizeBookName(name: string): string {
  let value = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[º°]/g, 'o')
    .replace(/\./g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  for (const [pattern, replacement] of ORDINAL_PREFIXES) {
    if (pattern.test(value)) {
      value = value.replace(pattern, replacement);
      break;
    }
  }
  return value.replace(/\s/g, '');
}

const INDEX = new Map<string, Book>();
for (const book of BOOKS) {
  for (const name of [book.id, book.es, book.en, ...book.aliases]) {
    const key = normalizeBookName(name);
    const existing = INDEX.get(key);
    if (existing && existing.id !== book.id) {
      throw new Error(`Book alias "${name}" is ambiguous between ${existing.id} and ${book.id}`);
    }
    INDEX.set(key, book);
  }
}

const BY_ID = new Map(BOOKS.map((book) => [book.id, book]));

/** Resolves a book by id, Spanish or English name, or common abbreviation. */
export function findBook(name: string): Book | undefined {
  return BY_ID.get(name.toUpperCase()) ?? INDEX.get(normalizeBookName(name));
}

/** Returns the book for a known API id, or throws. */
export function getBook(id: string): Book {
  const book = BY_ID.get(id);
  if (!book) throw new Error(`Unknown book id: ${id}`);
  return book;
}
