import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { homedir } from 'node:os';

/**
 * Response cache keyed by API path ("spa_r09/JHN/3.json"). The API publishes
 * immutable, freely storable JSON files, so entries never expire.
 */
export interface Cache {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

export class MemoryCache implements Cache {
  readonly #entries = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.#entries.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    this.#entries.set(key, value);
  }
}

export class FileCache implements Cache {
  readonly #root: string;

  constructor(directory: string = defaultCacheDir()) {
    this.#root = resolve(directory);
  }

  async get(key: string): Promise<string | undefined> {
    try {
      return await readFile(this.#pathFor(key), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  async set(key: string, value: string): Promise<void> {
    const path = this.#pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value, 'utf8');
  }

  #pathFor(key: string): string {
    const path = resolve(join(this.#root, key));
    if (!path.startsWith(this.#root + sep)) throw new Error(`Invalid cache key: ${key}`);
    return path;
  }
}

/** `$BIBLE_AI_CACHE_DIR`, else `$XDG_CACHE_HOME/bible-ai`, else `~/.cache/bible-ai`. */
export function defaultCacheDir(): string {
  if (process.env.BIBLE_AI_CACHE_DIR) return process.env.BIBLE_AI_CACHE_DIR;
  const base = process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache');
  return join(base, 'bible-ai');
}
