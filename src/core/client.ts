import type { Cache } from './cache.ts';
import type {
  Commentary,
  CommentaryChapter,
  CrossReferenceChapter,
  Dataset,
  Translation,
  TranslationBook,
  TranslationChapter,
} from './types.ts';

export const DEFAULT_BASE_URL = 'https://bible.helloao.org';

export interface BibleApiClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  cache?: Cache;
}

export class BibleApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string) {
    super(`Bible API responded ${status} for /api/${path}`);
    this.name = 'BibleApiError';
    this.status = status;
    this.path = path;
  }
}

/** Typed client for the Free Use Bible API. Every method maps to one static JSON file. */
export class BibleApiClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #cache: Cache | undefined;

  constructor(options: BibleApiClientOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#cache = options.cache;
  }

  availableTranslations(): Promise<{ translations: Translation[] }> {
    return this.get('available_translations.json');
  }

  books(translation: string): Promise<{ translation: Translation; books: TranslationBook[] }> {
    return this.get(`${translation}/books.json`);
  }

  chapter(translation: string, book: string, chapter: number): Promise<TranslationChapter> {
    return this.get(`${translation}/${book}/${chapter}.json`);
  }

  availableCommentaries(): Promise<{ commentaries: Commentary[] }> {
    return this.get('available_commentaries.json');
  }

  commentaryChapter(commentary: string, book: string, chapter: number): Promise<CommentaryChapter> {
    return this.get(`c/${commentary}/${book}/${chapter}.json`);
  }

  /** Like `commentaryChapter`, but `undefined` when the commentary does not cover the chapter. */
  tryCommentaryChapter(commentary: string, book: string, chapter: number): Promise<CommentaryChapter | undefined> {
    return this.tryGet(`c/${commentary}/${book}/${chapter}.json`);
  }

  availableDatasets(): Promise<{ datasets: Dataset[] }> {
    return this.get('available_datasets.json');
  }

  datasetChapter<T>(dataset: string, book: string, chapter: number): Promise<T> {
    return this.get(`d/${dataset}/${book}/${chapter}.json`);
  }

  crossReferences(book: string, chapter: number): Promise<CrossReferenceChapter> {
    return this.datasetChapter('open-cross-ref', book, chapter);
  }

  /** Fetches `/api/<path>`, reading and filling the cache. */
  async get<T>(path: string): Promise<T> {
    const cached = await this.#cache?.get(path);
    if (cached !== undefined) return JSON.parse(cached) as T;

    const response = await this.#fetch(`${this.#baseUrl}/api/${path}`);
    if (!response.ok) throw new BibleApiError(response.status, path);
    const body = await response.text();
    const value = JSON.parse(body) as T;
    await this.#cache?.set(path, body);
    return value;
  }

  async tryGet<T>(path: string): Promise<T | undefined> {
    try {
      return await this.get<T>(path);
    } catch (error) {
      if (error instanceof BibleApiError && error.status === 404) return undefined;
      throw error;
    }
  }
}
