export const DEFAULT_BASE_URL = 'https://bible.helloao.org';
export class BibleApiError extends Error {
    status;
    path;
    constructor(status, path) {
        super(`Bible API responded ${status} for /api/${path}`);
        this.name = 'BibleApiError';
        this.status = status;
        this.path = path;
    }
}
const SAFE_ID = /^[A-Za-z0-9_-]+$/;
/** Ids become URL and cache path segments, so only plain identifiers are accepted. */
function safeId(value, kind) {
    if (!SAFE_ID.test(value))
        throw new Error(`Invalid ${kind} id "${value}": use letters, digits, "_" or "-".`);
    return value;
}
function safeChapter(value) {
    if (!Number.isInteger(value) || value < 1)
        throw new Error(`Invalid chapter number: ${value}`);
    return value;
}
/** Typed client for the Free Use Bible API. Every method maps to one static JSON file. */
export class BibleApiClient {
    #baseUrl;
    #fetch;
    #cache;
    constructor(options = {}) {
        this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.#fetch = options.fetch ?? globalThis.fetch;
        this.#cache = options.cache;
    }
    availableTranslations() {
        return this.get('available_translations.json');
    }
    async books(translation) {
        return this.get(`${safeId(translation, 'translation')}/books.json`);
    }
    async chapter(translation, book, chapter) {
        return this.get(`${safeId(translation, 'translation')}/${safeId(book, 'book')}/${safeChapter(chapter)}.json`);
    }
    availableCommentaries() {
        return this.get('available_commentaries.json');
    }
    async commentaryChapter(commentary, book, chapter) {
        return this.get(commentaryPath(commentary, book, chapter));
    }
    /** Like `commentaryChapter`, but `undefined` when the commentary does not cover the chapter. */
    async tryCommentaryChapter(commentary, book, chapter) {
        return this.tryGet(commentaryPath(commentary, book, chapter));
    }
    availableDatasets() {
        return this.get('available_datasets.json');
    }
    async datasetChapter(dataset, book, chapter) {
        return this.get(`d/${safeId(dataset, 'dataset')}/${safeId(book, 'book')}/${safeChapter(chapter)}.json`);
    }
    /** Like `datasetChapter`, but `undefined` when the dataset does not cover the chapter. */
    async tryDatasetChapter(dataset, book, chapter) {
        return this.tryGet(`d/${safeId(dataset, 'dataset')}/${safeId(book, 'book')}/${safeChapter(chapter)}.json`);
    }
    /** A lexicon entry by padded Strong's id, e.g. `lexiconEntry('stepbible-lexicon', 'G0025')`. */
    async lexiconEntry(dataset, strongs) {
        return this.get(`d/${safeId(dataset, 'dataset')}/lexicon/${safeId(strongs, "Strong's")}.json`);
    }
    /** Like `lexiconEntry`, but `undefined` when the lexicon has no such entry. */
    async tryLexiconEntry(dataset, strongs) {
        return this.tryGet(`d/${safeId(dataset, 'dataset')}/lexicon/${safeId(strongs, "Strong's")}.json`);
    }
    /** A dataset-wide list, e.g. `datasetIndex('theographic', 'people')` for `d/theographic/people.json`. */
    async datasetIndex(dataset, index) {
        return this.get(`d/${safeId(dataset, 'dataset')}/${safeId(index, 'index')}.json`);
    }
    /** One entity of a dataset, e.g. `datasetEntity('theographic', 'people', 'paul_2479')`. */
    async datasetEntity(dataset, kind, id) {
        return this.get(`d/${safeId(dataset, 'dataset')}/${safeId(kind, 'entity kind')}/${safeId(id, 'entity')}.json`);
    }
    crossReferences(book, chapter) {
        return this.datasetChapter('open-cross-ref', book, chapter);
    }
    /** Fetches `/api/<path>`, reading and filling the cache. */
    async get(path) {
        const cached = await this.#cache?.get(path);
        if (cached !== undefined)
            return JSON.parse(cached);
        const response = await this.#fetch(`${this.#baseUrl}/api/${path}`);
        if (!response.ok)
            throw new BibleApiError(response.status, path);
        const body = await response.text();
        const value = JSON.parse(body);
        await this.#cache?.set(path, body);
        return value;
    }
    /** Like `get`, but `undefined` on 404. */
    async tryGet(path) {
        try {
            return await this.get(path);
        }
        catch (error) {
            if (error instanceof BibleApiError && error.status === 404)
                return undefined;
            throw error;
        }
    }
}
function commentaryPath(commentary, book, chapter) {
    return `c/${safeId(commentary, 'commentary')}/${safeId(book, 'book')}/${safeChapter(chapter)}.json`;
}
