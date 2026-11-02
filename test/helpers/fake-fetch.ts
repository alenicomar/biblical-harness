/** A fetch stand-in serving JSON fixtures by API path and recording every requested URL. */
export interface FakeFetch {
  fetch: typeof fetch;
  calls: string[];
}

export function fakeFetch(routes: Record<string, unknown>, statusFor: Record<string, number> = {}): FakeFetch {
  const calls: string[] = [];
  const impl = async (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    const path = new URL(url).pathname;
    const status = statusFor[path];
    if (status !== undefined) return new Response('error', { status });
    if (!(path in routes)) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(routes[path]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch: impl as typeof fetch, calls };
}

/** Minimal translation chapter fixture: verses as plain strings, with an optional heading first. */
export function chapterFixture(translation: string, book: string, number: number, verses: string[], heading?: string) {
  return {
    translation: { id: translation, name: `${translation} name`, shortName: translation.toUpperCase() },
    book: { id: book, name: book },
    chapter: {
      number,
      content: [
        ...(heading ? [{ type: 'heading', content: [heading] }] : []),
        ...verses.map((text, index) => ({ type: 'verse', number: index + 1, content: [text] })),
      ],
      footnotes: [],
    },
  };
}
