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
  /** Defaults to `$BIBLICAL_HARNESS_MODEL`, else `claude-sonnet-5-5`. */
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
    // Header values must be printable ASCII; reject without echoing the key.
    if (!/^[\x21-\x7E]+$/.test(apiKey.trim())) throw new Error('ANTHROPIC_API_KEY contains invalid characters.');
    this.#apiKey = apiKey.trim();
    this.model = options.model ?? process.env.BIBLICAL_HARNESS_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
    this.#baseUrl = (options.baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '');
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async complete(request: LlmRequest): Promise<string> {
    let response: Response;
    try {
      response = await this.#send(request);
    } catch (error) {
      throw new Error(`Anthropic API request failed: ${this.#redact((error as Error).message)}`);
    }
    const body = (await response.json().catch(() => ({}))) as {
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(`Anthropic API responded ${response.status}: ${this.#redact(body.error?.message ?? 'no details')}`);
    }
    return (body.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
  }

  #redact(text: string): string {
    return text.replaceAll(this.#apiKey, '[redacted]');
  }

  #send(request: LlmRequest): Promise<Response> {
    return this.#fetch(`${this.#baseUrl}/v1/messages`, {
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
  }
}
