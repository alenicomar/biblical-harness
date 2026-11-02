import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnthropicProvider } from '../../src/harness/llm.ts';

function capture(status: number, body: unknown) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const impl = async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status });
  };
  return { fetch: impl as typeof fetch, requests };
}

test('AnthropicProvider posts a Messages API request and joins text blocks', async () => {
  const fake = capture(200, { content: [{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }] });
  const llm = new AnthropicProvider({ apiKey: 'sk-test', model: 'claude-test', fetch: fake.fetch });

  const reply = await llm.complete({ system: 'SYS', user: 'USER', maxTokens: 123 });

  assert.equal(reply, '{"a":1}');
  const [request] = fake.requests;
  assert.equal(request?.url, 'https://api.anthropic.com/v1/messages');
  const headers = request?.init.headers as Record<string, string>;
  assert.equal(headers['x-api-key'], 'sk-test');
  assert.equal(headers['anthropic-version'], '2023-06-01');
  assert.deepEqual(JSON.parse(String(request?.init.body)), {
    model: 'claude-test',
    max_tokens: 123,
    system: 'SYS',
    messages: [{ role: 'user', content: 'USER' }],
  });
});

test('AnthropicProvider errors carry the status but never the API key', async () => {
  const fake = capture(401, { error: { message: 'invalid x-api-key' } });
  const llm = new AnthropicProvider({ apiKey: 'sk-secret', fetch: fake.fetch });
  await assert.rejects(llm.complete({ system: 's', user: 'u' }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /401/);
    assert.ok(!error.message.includes('sk-secret'));
    return true;
  });
});

test('AnthropicProvider requires an API key', () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    assert.throws(() => new AnthropicProvider(), /ANTHROPIC_API_KEY/);
  } finally {
    if (previous !== undefined) process.env.ANTHROPIC_API_KEY = previous;
  }
});
