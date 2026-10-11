import { describe, expect, test, vi } from 'vitest';

import { ApiClient, type TokenStore } from './client.ts';
import { ApiError } from './problem.ts';

function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      type: `https://soirely.com/errors/${code}`,
      title: 'Something happened.',
      status,
      ...extra,
    }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function store(access: string | null, refresh: string | null): TokenStore & { saved: unknown } {
  return {
    saved: null,
    access: () => access,
    refresh: () => refresh,
    save(tokens) {
      this.saved = tokens;
      access = tokens.access;
    },
    clear() {
      access = null;
      refresh = null;
    },
  };
}

describe('errors arrive as problem documents', () => {
  test('a failure rejects with the code, not just a status', async () => {
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      fetch: async () => problem(404, 'not_found'),
    });

    await expect(client.get('/api/guests/1')).rejects.toThrow(ApiError);
    await client.get('/api/guests/1').catch((e: ApiError) => {
      expect(e.code).toBe('not_found');
      expect(e.status).toBe(404);
      expect(e.is('not_found')).toBe(true);
    });
  });

  test('violations become field errors a form can mark', async () => {
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      fetch: async () =>
        problem(422, 'validation_failed', {
          violations: [
            { propertyPath: 'email', message: 'Not an email address.', code: 'not_an_email' },
            { propertyPath: 'email', message: 'Also too long.', code: 'too_long' },
            { propertyPath: 'name', message: 'Required.', code: 'blank' },
          ],
        }),
    });

    await client.post('/api/guests', {}).catch((e: ApiError) => {
      // First per field wins — four stacked messages on one input is not more
      // helpful than its first.
      expect(e.fieldErrors()).toEqual({
        email: 'Not an email address.',
        name: 'Required.',
      });
    });
  });

  /**
   * A proxy returning HTML, or a connection cut mid-response, is exactly when
   * a caller most needs a usable error rather than a parse failure.
   */
  test('a response that is not a problem document still produces one', async () => {
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      fetch: async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }),
    });

    await client.get('/api/health').catch((e: ApiError) => {
      expect(e.status).toBe(502);
      expect(e.code).toBe('internal_error');
    });
  });

  test('the correlation id is reachable for a support ticket', async () => {
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      fetch: async () => problem(500, 'internal_error', { correlationId: 'abc-123' }),
    });

    await client.get('/api/health').catch((e: ApiError) => {
      expect(e.correlationId).toBe('abc-123');
    });
  });
});

describe('the session refreshes without signing anybody out', () => {
  test('a 401 is retried once after a successful refresh', async () => {
    const tokens = store('expired', 'good-refresh');
    let call = 0;

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      fetch: async (input) => {
        const url = String(input);
        if (url.includes('/auth/refresh')) {
          return new Response(JSON.stringify({ data: { access: 'fresh', refresh: 'next' } }), {
            status: 200,
          });
        }
        call += 1;
        return call === 1
          ? problem(401, 'unauthenticated')
          : new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    await expect(client.get('/api/auth/me')).resolves.toEqual({ ok: true });
    expect(call).toBe(2);
    expect(tokens.saved).toEqual({ access: 'fresh', refresh: 'next' });
  });

  /**
   * The API rotates refresh tokens and treats a replay as theft — it revokes
   * the whole chain. Four requests failing together must therefore start ONE
   * refresh, or the second replays the first's token and signs the user out
   * in the middle of what they were doing.
   */
  test('concurrent failures start exactly one refresh', async () => {
    const tokens = store('expired', 'good-refresh');
    let refreshes = 0;
    let served = 0;

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      fetch: async (input) => {
        if (String(input).includes('/auth/refresh')) {
          refreshes += 1;
          await new Promise((r) => setTimeout(r, 10));
          return new Response(JSON.stringify({ data: { access: 'fresh', refresh: 'next' } }), {
            status: 200,
          });
        }
        served += 1;
        return served <= 4
          ? problem(401, 'unauthenticated')
          : new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    await Promise.all([
      client.get('/api/a'),
      client.get('/api/b'),
      client.get('/api/c'),
      client.get('/api/d'),
    ]);

    expect(refreshes).toBe(1);
  });

  test('a failed refresh clears the session and says so once', async () => {
    const tokens = store('expired', 'stale-refresh');
    const onSignedOut = vi.fn();

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      onSignedOut,
      fetch: async (input) =>
        String(input).includes('/auth/refresh')
          ? problem(401, 'unauthenticated')
          : problem(401, 'unauthenticated'),
    });

    await expect(client.get('/api/auth/me')).rejects.toThrow(ApiError);
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });

  test('an anonymous request never sends a token and is never retried', async () => {
    const tokens = store('present', 'present');
    let refreshes = 0;
    let authHeader: string | null = 'unset';

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      fetch: async (input, init) => {
        if (String(input).includes('/auth/refresh')) refreshes += 1;
        authHeader = new Headers(init?.headers).get('Authorization');
        return problem(401, 'unauthenticated');
      },
    });

    await client.post('/api/auth/login', {}, { anonymous: true }).catch(() => undefined);

    expect(authHeader).toBeNull();
    expect(refreshes).toBe(0);
  });
});

describe('request building', () => {
  test('the base url is read at call time, not at construction', async () => {
    let base = 'http://first.test';
    const seen: string[] = [];

    const client = new ApiClient({
      baseUrl: () => base,
      fetch: async (input) => {
        seen.push(String(input));
        return new Response('{}', { status: 200 });
      },
    });

    await client.get('/api/health');
    base = 'http://second.test';
    await client.get('/api/health');

    expect(seen[0]).toContain('first.test');
    expect(seen[1]).toContain('second.test');
  });

  test('undefined query values are omitted rather than sent as the word undefined', async () => {
    let url = '';
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      fetch: async (input) => {
        url = String(input);
        return new Response('{}', { status: 200 });
      },
    });

    await client.get('/api/guests', { query: { search: 'ada', rsvp: undefined, page: 2 } });

    expect(url).toContain('search=ada');
    expect(url).toContain('page=2');
    expect(url).not.toContain('rsvp');
  });

  test('the reader language reaches the API for its own negotiation', async () => {
    let header: string | null = null;
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      locale: () => 'pt',
      fetch: async (_input, init) => {
        header = new Headers(init?.headers).get('Accept-Language');
        return new Response('{}', { status: 200 });
      },
    });

    await client.get('/api/health');
    expect(header).toBe('pt');
  });

  test('a 204 resolves rather than failing to parse an empty body', async () => {
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      fetch: async () => new Response(null, { status: 204 }),
    });

    await expect(client.delete('/api/guests/1')).resolves.toBeUndefined();
  });
});
