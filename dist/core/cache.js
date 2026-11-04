import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
export class MemoryCache {
    #entries = new Map();
    async get(key) {
        return this.#entries.get(key);
    }
    async set(key, value) {
        this.#entries.set(key, value);
    }
}
export class FileCache {
    #root;
    constructor(directory = defaultCacheDir()) {
        this.#root = resolve(directory);
    }
    async get(key) {
        try {
            return await readFile(this.#pathFor(key), 'utf8');
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return undefined;
            throw error;
        }
    }
    async set(key, value) {
        const path = this.#pathFor(key);
        await mkdir(dirname(path), { recursive: true });
        // Write then rename, so an interrupted or concurrent run never leaves a truncated entry.
        const temporary = `${path}.${randomUUID()}.tmp`;
        try {
            await writeFile(temporary, value, 'utf8');
            await rename(temporary, path);
        }
        catch (error) {
            await rm(temporary, { force: true });
            throw error;
        }
    }
    #pathFor(key) {
        const path = resolve(join(this.#root, key));
        if (!path.startsWith(this.#root + sep))
            throw new Error(`Invalid cache key: ${key}`);
        return path;
    }
}
/** `$BIBLICAL_HARNESS_CACHE_DIR`, else `$XDG_CACHE_HOME/biblical-harness`, else `~/.cache/biblical-harness`. */
export function defaultCacheDir() {
    if (process.env.BIBLICAL_HARNESS_CACHE_DIR)
        return process.env.BIBLICAL_HARNESS_CACHE_DIR;
    const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
    return join(base, 'biblical-harness');
}
