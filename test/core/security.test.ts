import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { defaultCacheDir, FileCache } from '../../src/core/cache.ts';
import { BibleApiClient } from '../../src/core/client.ts';
import { main } from '../../src/cli/main.ts';
import { AnthropicProvider } from '../../src/harness/llm.ts';
import { fakeFetch } from '../helpers/fake-fetch.ts';

test('FileCache rejects keys that escape its directory and leaves no temp files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bible-ai-sec-'));
  try {
    const cache = new FileCache(join(dir, 'c'));
    for (const key of ['', '../x', '../../x/JHN/3.json', 'a/../../x']) {
      await assert.rejects(cache.set(key, '{}'), /Invalid cache key/);
    }
    await cache.set('spa_r09/books.json', '{}');
    assert.deepEqual(await readdir(dir), ['c']);
    assert.deepEqual(await readdir(join(dir, 'c', 'spa_r09')), ['books.json']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the client rejects unsafe ids before any request', async () => {
  const fake = fakeFetch({});
  const client = new BibleApiClient({ fetch: fake.fetch });
  for (const id of ['../../x', '', 'x?q=1#', '%2e%2e', '/etc/passwd']) {
    await assert.rejects(client.chapter(id, 'JHN', 3), /Invalid translation id/, id);
  }
  await assert.rejects(client.commentaryChapter('../c', 'JHN', 3), /Invalid commentary id/);
  await assert.rejects(client.chapter('spa_r09', '../JHN', 3), /Invalid book id/);
  assert.deepEqual(fake.calls, []);
});

test('passage --translation ../ exits 1 without requests or cache writes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bible-ai-sec-'));
  const previous = process.env.BIBLE_AI_CACHE_DIR;
  process.env.BIBLE_AI_CACHE_DIR = join(dir, 'cache');
  try {
    const { fetch, calls } = fakeFetch({});
    let err = '';
    const code = await main(['passage', 'Jn 3:16', '--translation', '../../x'], {
      stdout: () => {},
      stderr: (text) => (err += text),
      fetch,
    });
    assert.equal(code, 1);
    assert.deepEqual(calls, []);
    assert.match(err, /Invalid translation id "\.\.\/\.\.\/x"/);
    assert.deepEqual(await readdir(dir), []);
  } finally {
    if (previous === undefined) delete process.env.BIBLE_AI_CACHE_DIR;
    else process.env.BIBLE_AI_CACHE_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test('AnthropicProvider rejects malformed keys without echoing them', () => {
  assert.throws(
    () => new AnthropicProvider({ apiKey: 'sk-ant-SECRET\nX' }),
    (error: Error) => /ANTHROPIC_API_KEY contains invalid characters/.test(error.message) && !error.message.includes('SECRET'),
  );
});

test('AnthropicProvider redacts the key from transport errors', async () => {
  const provider = new AnthropicProvider({
    apiKey: 'sk-ant-SECRET',
    fetch: (async () => {
      throw new Error('socket hang up while sending sk-ant-SECRET');
    }) as typeof fetch,
  });
  await assert.rejects(
    provider.complete({ system: 's', user: 'u' }),
    (error: Error) => /Anthropic API request failed: socket hang up while sending \[redacted\]/.test(error.message),
  );
});

test('an empty XDG_CACHE_HOME falls back to an absolute default', () => {
  const saved = { xdg: process.env.XDG_CACHE_HOME, own: process.env.BIBLE_AI_CACHE_DIR };
  delete process.env.BIBLE_AI_CACHE_DIR;
  process.env.XDG_CACHE_HOME = '';
  try {
    assert.ok(isAbsolute(defaultCacheDir()));
  } finally {
    if (saved.xdg === undefined) delete process.env.XDG_CACHE_HOME;
    else process.env.XDG_CACHE_HOME = saved.xdg;
    if (saved.own !== undefined) process.env.BIBLE_AI_CACHE_DIR = saved.own;
  }
});
