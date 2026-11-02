import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BibleApiClient, BibleApiError } from '../../src/core/client.ts';
import { FileCache, MemoryCache } from '../../src/core/cache.ts';
import { fakeFetch, chapterFixture } from '../helpers/fake-fetch.ts';

const JHN3 = chapterFixture('spa_r09', 'JHN', 3, ['Y había un hombre.', 'Este vino á Jesús de noche.']);

test('fetches API paths under the base URL and caches them permanently', async () => {
  const fake = fakeFetch({ '/api/spa_r09/JHN/3.json': JHN3 });
  const client = new BibleApiClient({ fetch: fake.fetch, cache: new MemoryCache() });

  const first = await client.chapter('spa_r09', 'JHN', 3);
  const second = await client.chapter('spa_r09', 'JHN', 3);

  assert.equal(first.chapter.number, 3);
  assert.deepEqual(second, first);
  assert.deepEqual(fake.calls, ['https://bible.helloao.org/api/spa_r09/JHN/3.json']);
});

test('builds commentary and dataset paths', async () => {
  const fake = fakeFetch({
    '/api/c/matthew-henry/JHN/3.json': { chapter: { number: 3, content: [] } },
    '/api/d/open-cross-ref/JHN/3.json': { chapter: { number: 3, content: [] } },
    '/api/available_commentaries.json': { commentaries: [] },
  });
  const client = new BibleApiClient({ fetch: fake.fetch, baseUrl: 'https://example.test/' });

  await client.commentaryChapter('matthew-henry', 'JHN', 3);
  await client.crossReferences('JHN', 3);
  await client.availableCommentaries();

  assert.deepEqual(fake.calls, [
    'https://example.test/api/c/matthew-henry/JHN/3.json',
    'https://example.test/api/d/open-cross-ref/JHN/3.json',
    'https://example.test/api/available_commentaries.json',
  ]);
});

test('throws BibleApiError with status and path on HTTP failure, without caching it', async () => {
  const fake = fakeFetch({}, { '/api/spa_r09/books.json': 503 });
  const cache = new MemoryCache();
  const client = new BibleApiClient({ fetch: fake.fetch, cache });

  await assert.rejects(client.books('spa_r09'), (error: unknown) => {
    assert.ok(error instanceof BibleApiError);
    assert.equal(error.status, 503);
    assert.match(error.message, /503 .*\/api\/spa_r09\/books\.json/);
    return true;
  });
  assert.equal(await cache.get('spa_r09/books.json'), undefined);
});

test('tryCommentaryChapter returns undefined when the commentary lacks the book', async () => {
  const client = new BibleApiClient({ fetch: fakeFetch({}).fetch });
  assert.equal(await client.tryCommentaryChapter('keil-delitzsch', 'JHN', 3), undefined);
});

test('FileCache stores entries under its directory and refuses path traversal', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bible-ai-cache-'));
  try {
    const cache = new FileCache(dir);
    await cache.set('spa_r09/JHN/3.json', '{"ok":true}');
    assert.equal(await cache.get('spa_r09/JHN/3.json'), '{"ok":true}');
    assert.equal(await readFile(join(dir, 'spa_r09/JHN/3.json'), 'utf8'), '{"ok":true}');
    assert.equal(await cache.get('missing.json'), undefined);
    await assert.rejects(cache.set('../escape.json', 'x'), /Invalid cache key/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
