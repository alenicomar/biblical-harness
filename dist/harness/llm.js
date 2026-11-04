export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';
/** Anthropic Messages API over plain fetch. */
export class AnthropicProvider {
    name = 'anthropic';
    model;
    #apiKey;
    #baseUrl;
    #fetch;
    constructor(options = {}) {
        const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
        if (!apiKey)
            throw new Error('AnthropicProvider needs an API key: pass apiKey or set ANTHROPIC_API_KEY.');
        // Header values must be printable ASCII; reject without echoing the key.
        if (!/^[\x21-\x7E]+$/.test(apiKey.trim()))
            throw new Error('ANTHROPIC_API_KEY contains invalid characters.');
        this.#apiKey = apiKey.trim();
        this.model = options.model ?? process.env.BIBLICAL_HARNESS_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
        this.#baseUrl = (options.baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '');
        this.#fetch = options.fetch ?? globalThis.fetch;
    }
    async complete(request) {
        let response;
        try {
            response = await this.#send(request);
        }
        catch (error) {
            throw new Error(`Anthropic API request failed: ${this.#redact(error.message)}`);
        }
        const body = (await response.json().catch(() => ({})));
        if (!response.ok) {
            throw new Error(`Anthropic API responded ${response.status}: ${this.#redact(body.error?.message ?? 'no details')}`);
        }
        return (body.content ?? [])
            .filter((block) => block.type === 'text')
            .map((block) => block.text ?? '')
            .join('');
    }
    #redact(text) {
        return text.replaceAll(this.#apiKey, '[redacted]');
    }
    #send(request) {
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
