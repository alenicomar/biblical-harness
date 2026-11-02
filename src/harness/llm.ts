/** The pipeline face talks to a model only through this interface. */
export interface LlmRequest {
  system: string;
  user: string;
  maxTokens?: number;
}

export interface LlmProvider {
  name: string;
  complete(request: LlmRequest): Promise<string>;
}

export interface AnthropicProviderOptions {
  /** Defaults to `$ANTHROPIC_API_KEY`. */
  apiKey?: string;
  /** Defaults to `$BIBLE_AI_MODEL`, else `claude-sonnet-5-5`. */
  model?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';

/** Anthropic Messages API over plain fetch. */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly model: string;
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: AnthropicProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('AnthropicProvider needs an API key: pass apiKey or set ANTHROPIC_API_KEY.');
    this.#apiKey = apiKey;
    this.model = options.model ?? process.env.BIBLE_AI_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
    this.#baseUrl = (options.baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '');
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async complete(request: LlmRequest): Promise<string> {
    const response = await this.#fetch(`${this.#baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.#apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens ?? 8000,
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      const detail = body.error?.message?.replaceAll(this.#apiKey, '[redacted]') ?? 'no details';
      throw new Error(`Anthropic API responded ${response.status}: ${detail}`);
    }
    return (body.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
  }
}
