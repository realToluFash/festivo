import { describe, expect, test, vi } from 'vitest';

import {
  ApiClient,
  type IssuedTokens,
  type TokenStore,
  awaiting,
  phoneAwaitingCode,
  primaryEmailAddress,
} from './client.ts';
import { ApiError, ApiUnreachableError } from './problem.ts';

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
      access = tokens.accessToken;
      refresh = tokens.refreshToken ?? null;
    },
    clear() {
      access = null;
      refresh = null;
    },
  };
}

function issued(overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      accessToken: 'fresh',
      refreshToken: 'next',
      refreshExpiresAt: '2026-11-14T00:00:00+00:00',
      sessionId: '018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f',
      ...overrides,
    }),
    { status: 200 },
  );
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
        if (url.includes('/auth/refresh')) return issued();
        call += 1;
        return call === 1
          ? problem(401, 'unauthenticated')
          : new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    await expect(client.get('/api/auth/me')).resolves.toEqual({ ok: true });
    expect(call).toBe(2);
    expect(tokens.saved).toMatchObject({ accessToken: 'fresh', refreshToken: 'next' });
  });

  test('a wrong password on a signed-in request is the answer: no refresh, no second try', async () => {
    const seen: string[] = [];
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('live', 'good-refresh'),
      fetch: async (input) => {
        seen.push(new URL(String(input)).pathname);
        return problem(401, 'invalid_credentials');
      },
    });

    await expect(
      client.changePassword({
        currentPassword: 'wrong',
        newPassword: 'a brand new passphrase',
        sessionId: 's',
      }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(seen).toEqual(['/api/auth/password']);
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
          return issued();
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

  test('a refresh that cannot reach the API keeps the session', async () => {
    const tokens = store('expired', 'good-refresh');
    const onSignedOut = vi.fn();

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      onSignedOut,
      fetch: async (input) => {
        if (String(input).includes('/auth/refresh')) throw new TypeError('Failed to fetch');
        return problem(401, 'unauthenticated');
      },
    });

    await expect(client.get('/api/auth/me')).rejects.toThrow(ApiUnreachableError);
    expect(onSignedOut).not.toHaveBeenCalled();
    expect(tokens.refresh()).toBe('good-refresh');
  });

  test('a refresh answered by a gateway with nothing behind it keeps the session', async () => {
    const tokens = store('expired', 'good-refresh');
    const onSignedOut = vi.fn();

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      onSignedOut,
      fetch: async (input) =>
        String(input).includes('/auth/refresh')
          ? new Response('Bad Gateway', { status: 502 })
          : problem(401, 'unauthenticated'),
    });

    await expect(client.get('/api/auth/me')).rejects.toThrow(ApiUnreachableError);
    expect(onSignedOut).not.toHaveBeenCalled();
    expect(tokens.refresh()).toBe('good-refresh');
  });

  test('a request that never arrives says the API is unreachable', async () => {
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
    });

    await expect(client.get('/api/events')).rejects.toThrow(ApiUnreachableError);
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

describe('a browser never holds the refresh token', () => {
  test('refreshing sends no token of its own and lets the cookie travel', async () => {
    const tokens = store('expired', null);
    let body: unknown = null;
    let credentials: string | undefined;
    let served = 0;

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      refreshTokenIn: 'cookie',
      fetch: async (input, init) => {
        if (String(input).includes('/auth/refresh')) {
          body = JSON.parse(String(init?.body));
          credentials = init?.credentials;
          return issued({ refreshToken: undefined });
        }
        served += 1;
        return served === 1
          ? problem(401, 'unauthenticated')
          : new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    await expect(client.get('/api/auth/me')).resolves.toEqual({ ok: true });

    expect(body).toEqual({ refreshTokenIn: 'cookie' });
    expect(credentials).toBe('include');
  });

  test('a response with no refresh token is the expected one, not a failure', async () => {
    const tokens = store('expired', null);
    const onSignedOut = vi.fn();
    let served = 0;

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      refreshTokenIn: 'cookie',
      onSignedOut,
      fetch: async (input) => {
        if (String(input).includes('/auth/refresh')) return issued({ refreshToken: undefined });
        served += 1;
        return served === 1
          ? problem(401, 'unauthenticated')
          : new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });

    await client.get('/api/auth/me');

    expect(onSignedOut).not.toHaveBeenCalled();
    expect(tokens.saved).toMatchObject({ accessToken: 'fresh' });
    expect((tokens.saved as IssuedTokens).refreshToken).toBeUndefined();
  });

  test('the same response in body mode ends the session', async () => {
    const tokens = store('expired', 'present');
    const onSignedOut = vi.fn();

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      onSignedOut,
      fetch: async (input) =>
        String(input).includes('/auth/refresh')
          ? issued({ refreshToken: undefined })
          : problem(401, 'unauthenticated'),
    });

    await client.get('/api/auth/me').catch(() => undefined);

    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });

  test('the cookie is not attached to ordinary requests', async () => {
    const seen: (string | undefined)[] = [];

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      refreshTokenIn: 'cookie',
      fetch: async (_input, init) => {
        seen.push(init?.credentials);
        return new Response('{}', { status: 200 });
      },
    });

    await client.get('/api/guests');

    expect(seen).toEqual([undefined]);
  });

  test('signing in saves what came back and says where it wants the token', async () => {
    const tokens = store(null, null);
    let body: unknown = null;

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      refreshTokenIn: 'cookie',
      fetch: async (_input, init) => {
        body = JSON.parse(String(init?.body));
        return issued({ refreshToken: undefined, account: ACCOUNT });
      },
    });

    const result = await client.signIn('ada@example.com', 'a decent passphrase');

    expect(body).toMatchObject({ email: 'ada@example.com', refreshTokenIn: 'cookie' });
    if (!('tokens' in result)) throw new Error('expected tokens, not a challenge');
    expect(result.tokens.accessToken).toBe('fresh');
    expect(tokens.saved).toMatchObject({ accessToken: 'fresh' });
  });

  test('signing in answers with the account, in one request', async () => {
    const paths: string[] = [];

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store(null, null),
      fetch: async (input) => {
        paths.push(new URL(String(input)).pathname);
        return issued({ account: ACCOUNT });
      },
    });

    const result = await client.signIn('ada@example.com', 'a decent passphrase');
    if (!('account' in result)) throw new Error('expected the account, not a challenge');
    const { account } = result;

    expect(account.id).toBe(ACCOUNT.id);
    expect(account.emailAddresses).toHaveLength(ACCOUNT.emailAddresses.length);
    expect(paths).toEqual(['/api/auth/login']);
  });

  test('a sign-in answered without the account saves nothing', async () => {
    const tokens = store(null, null);

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      fetch: async () => issued(),
    });

    await expect(client.signIn('ada@example.com', 'a decent passphrase')).rejects.toThrow(
      /SignInController/,
    );
    expect(tokens.saved).toBeNull();
  });

  test('a sign-in the API refuses rejects with the code and saves nothing', async () => {
    const tokens = store(null, null);

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      refreshTokenIn: 'cookie',
      fetch: async () => problem(401, 'invalid_credentials'),
    });

    await expect(client.signIn('ada@example.com', 'wrong')).rejects.toThrow(ApiError);
    expect(tokens.saved).toBeNull();
  });

  test('registering answers with a handle and saves no tokens', async () => {
    const tokens = store(null, null);
    let sent: unknown = null;

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      fetch: async (_input, init) => {
        sent = JSON.parse(String(init?.body));
        return json({ registration: 'the-handle', email: 'ada@example.com' }, 202);
      },
    });

    const pending = await client.register('Ada@Example.com', 'Ada', 'a decent passphrase');

    expect(sent).toMatchObject({ email: 'Ada@Example.com', name: 'Ada' });
    expect(pending).toEqual({ registration: 'the-handle', email: 'ada@example.com' });
    expect(tokens.saved).toBeNull();
  });

  test('the code then makes the account and saves its tokens', async () => {
    const tokens = store(null, null);
    let sent: unknown = null;
    const paths: string[] = [];

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      fetch: async (input, init) => {
        paths.push(new URL(String(input)).pathname);
        sent = JSON.parse(String(init?.body));
        return issued({ account: ACCOUNT });
      },
    });

    const { account } = await client.confirmRegistration('the-handle', '123456');

    expect(sent).toMatchObject({ registration: 'the-handle', code: '123456' });
    expect(account.id).toBe(ACCOUNT.id);
    expect(tokens.saved).toMatchObject({ accessToken: 'fresh' });
    expect(paths).toEqual(['/api/auth/register/verify']);
  });

  test('a registration the API refuses rejects with the code and saves nothing', async () => {
    const tokens = store(null, null);

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      fetch: async () => problem(422, 'validation_failed'),
    });

    await expect(client.register('ada@example.com', 'Ada', 'a decent passphrase')).rejects.toThrow(
      ApiError,
    );
    expect(tokens.saved).toBeNull();
  });

  test("lists the caller's organisations with their role in each", async () => {
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      fetch: async () =>
        new Response(
          JSON.stringify({
            organisations: [
              {
                id: 'org_1',
                name: 'Ìrè Events',
                countryCode: 'NG',
                currency: 'NGN',
                timezone: 'Africa/Lagos',
                contactAddress: 'hello@ire.events',
                locale: 'en',
                role: { id: 'role_1', seededAs: 'owner', name: null },
              },
            ],
          }),
          { status: 200 },
        ),
    });

    const [first] = await client.organisations();

    expect(first?.name).toBe('Ìrè Events');
    expect(first?.role.seededAs).toBe('owner');
  });

  test('an organisation list in a shape it does not know is an error, not an empty list', async () => {
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      fetch: async () =>
        new Response(JSON.stringify({ organisations: [{ id: 'org_1' }] }), { status: 200 }),
    });

    await expect(client.organisations()).rejects.toThrow(/OrganisationController/);
  });

  test('an organisation is edited with only the fields that changed', async () => {
    let sent: { method: string | undefined; path: string; body: unknown } | null = null;

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      fetch: async (input, init) => {
        sent = {
          method: init?.method,
          path: new URL(String(input)).pathname,
          body: JSON.parse(String(init?.body)),
        };

        return new Response(
          JSON.stringify({
            id: 'org_1',
            name: 'Ìrè Events Ltd',
            countryCode: 'NG',
            currency: 'NGN',
            timezone: 'Africa/Lagos',
            contactAddress: 'hello@ire.events',
            locale: 'en',
          }),
          { status: 200 },
        );
      },
    });

    const saved = await client.updateOrganisation('org_1', { name: 'Ìrè Events Ltd' });

    expect(sent).toEqual({
      method: 'PATCH',
      path: '/api/orgs/org_1',
      body: { name: 'Ìrè Events Ltd' },
    });
    expect(saved.name).toBe('Ìrè Events Ltd');
  });

  test('an organisation is created with its name, country and the device timezone', async () => {
    let sent: { method: string | undefined; path: string; body: unknown } | null = null;

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      fetch: async (input, init) => {
        sent = {
          method: init?.method,
          path: new URL(String(input)).pathname,
          body: JSON.parse(String(init?.body)),
        };

        return new Response(
          JSON.stringify({
            organisation: {
              id: 'org_2',
              name: 'Lagos Supper Club',
              countryCode: 'NG',
              currency: 'NGN',
              timezone: 'Africa/Lagos',
              contactAddress: 'ada@example.com',
              locale: 'en',
              role: { id: 'role_9', seededAs: 'owner', name: null },
            },
          }),
          { status: 201 },
        );
      },
    });

    const created = await client.createOrganisation({
      name: 'Lagos Supper Club',
      countryCode: 'NG',
      timezone: 'Africa/Lagos',
    });

    expect(sent).toEqual({
      method: 'POST',
      path: '/api/orgs',
      body: { name: 'Lagos Supper Club', countryCode: 'NG', timezone: 'Africa/Lagos' },
    });
    expect(created.id).toBe('org_2');
    expect(created.role.seededAs).toBe('owner');
  });

  test('a created organisation answered without it is an error', async () => {
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      fetch: async () => new Response(JSON.stringify({}), { status: 201 }),
    });

    await expect(
      client.createOrganisation({ name: 'X', countryCode: 'NG', timezone: 'UTC' }),
    ).rejects.toThrow(/OrganisationController/);
  });

  test('roles are read with the grid, and a removed role names where its people go', async () => {
    const sent: { method: string | undefined; path: string; body: unknown }[] = [];
    const door = {
      id: 'role_6',
      seededAs: null,
      name: 'Door team',
      fixed: false,
      removable: true,
      permissions: ['events.read'],
      holders: 2,
    };

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      fetch: async (input, init) => {
        sent.push({
          method: init?.method,
          path: new URL(String(input)).pathname,
          body: init?.body == null ? null : JSON.parse(String(init.body)),
        });

        if (init?.method === 'DELETE') return new Response(null, { status: 204 });
        if (init?.method === 'GET')
          return json({ roles: [door], areas: [{ area: 'events', permissions: ['events.read'] }] });

        return json(door);
      },
    });

    const catalogue = await client.roles('org_1');
    await client.updateRole('org_1', 'role_6', { permissions: ['events.read'] });
    await client.deleteRole('org_1', 'role_6', 'role_5');

    expect(catalogue.roles[0]?.name).toBe('Door team');
    expect(catalogue.areas).toEqual([{ area: 'events', permissions: ['events.read'] }]);
    expect(sent.slice(1)).toEqual([
      {
        method: 'PATCH',
        path: '/api/orgs/org_1/roles/role_6',
        body: { permissions: ['events.read'] },
      },
      { method: 'DELETE', path: '/api/orgs/org_1/roles/role_6', body: { replacement: 'role_5' } },
    ]);
  });

  test('a membership carries what the sign-in rules keep back', async () => {
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      fetch: async () =>
        json({
          organisations: [
            {
              id: 'org_1',
              name: 'Ìrè Events',
              countryCode: 'NG',
              currency: 'NGN',
              timezone: 'Africa/Lagos',
              contactAddress: 'hello@ire.events',
              locale: 'en',
              role: { id: 'role_1', seededAs: 'owner', name: null },
              permissions: ['events.read'],
              withheldUntilTwoFactor: ['members.manage'],
              readOnlyUntilLinked: true,
              signInRules: {
                providerOnly: true,
                inactivityTimeoutDays: 7,
                administratorsNeedTwoFactor: true,
                changedAt: '2026-10-19T10:00:00+00:00',
              },
            },
          ],
        }),
    });

    const organisations = await client.organisations();

    expect(organisations[0]?.withheldUntilTwoFactor).toEqual(['members.manage']);
    expect(organisations[0]?.readOnlyUntilLinked).toBe(true);
    expect(organisations[0]?.signInRules.inactivityTimeoutDays).toBe(7);
  });

  test('sign-in rules are read with their history and saved with only what changed', async () => {
    const sent: { method: string | undefined; path: string; body: unknown }[] = [];
    const page = {
      providerOnly: true,
      inactivityTimeoutDays: null,
      administratorsNeedTwoFactor: false,
      changedAt: '2026-10-19T10:00:00+00:00',
      inactivityChoices: [7, 30],
      changes: [
        {
          at: '2026-10-19T10:00:00+00:00',
          by: { name: 'Adaeze Okafor', role: { id: 'role_1', seededAs: 'owner', name: null } },
          rule: 'providerOnly',
          now: true,
          was: false,
        },
      ],
      passwordOnly: [
        {
          userId: 'user_2',
          name: 'Bola Ade',
          role: { id: 'role_2', seededAs: 'coordinator', name: null },
        },
      ],
      ownTwoFactor: true,
      ownProvider: true,
    };

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      fetch: async (input, init) => {
        sent.push({
          method: init?.method,
          path: new URL(String(input)).pathname,
          body: init?.body == null ? null : JSON.parse(String(init.body)),
        });

        return json(page);
      },
    });

    const read = await client.signInRules('org_1');
    await client.updateSignInRules('org_1', { providerOnly: true });

    expect(read.changes[0]?.by.name).toBe('Adaeze Okafor');
    expect(read.passwordOnly?.[0]?.name).toBe('Bola Ade');
    expect(read.ownTwoFactor).toBe(true);
    expect(read.ownProvider).toBe(true);
    expect(sent).toEqual([
      { method: 'GET', path: '/api/orgs/org_1/sign-in-rules', body: null },
      { method: 'PATCH', path: '/api/orgs/org_1/sign-in-rules', body: { providerOnly: true } },
    ]);
  });

  test('sign-in rules for a member who may not change them have no password-only list, and name whose limit applies', async () => {
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      fetch: async () =>
        json({
          providerOnly: false,
          inactivityTimeoutDays: 30,
          administratorsNeedTwoFactor: false,
          changedAt: null,
          inactivityChoices: [7, 30],
          changes: [],
          inactivityLimit: { organisationId: 'org_2', organisation: 'Studio Lumen', days: 7 },
        }),
    });

    const page = await client.signInRules('org_1');

    expect(page.passwordOnly).toBeNull();
    expect(page.ownTwoFactor).toBe(false);
    expect(page.ownProvider).toBe(false);
    expect(page.inactivityLimit).toEqual({
      organisationId: 'org_2',
      organisation: 'Studio Lumen',
      days: 7,
    });
  });

  test('setting a phone sends the country and the number as typed, and says a code went out', async () => {
    let sent: { method?: string | undefined; path: string; body: unknown } | null = null;

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      fetch: async (input, init) => {
        sent = {
          method: init?.method,
          path: new URL(String(input)).pathname,
          body: JSON.parse(String(init?.body)),
        };

        return new Response(
          JSON.stringify({
            phone: {
              id: 'p1',
              number: '+2348035550142',
              countryCode: 'NG',
              verified: false,
              primary: true,
            },
            verificationNeeded: true,
            cooldownSeconds: 60,
          }),
          { status: 200 },
        );
      },
    });

    const result = await client.setPhone('NG', '0803 555 0142');

    expect(sent).toEqual({
      method: 'PUT',
      path: '/api/auth/phone',
      body: { countryCode: 'NG', number: '0803 555 0142' },
    });
    expect(result.phone?.number).toBe('+2348035550142');
    expect(result.verificationNeeded).toBe(true);
    expect(result.cooldownSeconds).toBe(60);
  });

  test('a refusal from the onboarding gate names the gate, and still rejects', async () => {
    const gates: string[] = [];

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      onGate: (gate) => gates.push(gate),
      fetch: async () => problem(403, 'profile_incomplete'),
    });

    await expect(client.organisations()).rejects.toThrow(ApiError);
    expect(gates).toEqual(['profile_incomplete']);
  });

  test('an ordinary refusal is not taken for a gate', async () => {
    const gates: string[] = [];

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      onGate: (gate) => gates.push(gate),
      fetch: async () => problem(403, 'permission_required'),
    });

    await expect(client.organisations()).rejects.toThrow(ApiError);
    expect(gates).toEqual([]);
  });

  test('saving the details answers with the account and whether a phone still needs verifying', async () => {
    let sent: unknown = null;

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('good', null),
      fetch: async (_input, init) => {
        sent = JSON.parse(String(init?.body));

        return new Response(
          JSON.stringify({ account: { ...ACCOUNT, complete: true }, verificationNeeded: false }),
          {
            status: 200,
          },
        );
      },
    });

    const saved = await client.completeProfile({
      name: 'Ada',
      organisationName: 'Ìrè Events',
      countryCode: 'NG',
      timezone: 'Africa/Lagos',
    });

    expect(sent).toEqual({
      name: 'Ada',
      organisationName: 'Ìrè Events',
      countryCode: 'NG',
      timezone: 'Africa/Lagos',
    });
    expect(saved.account.complete).toBe(true);
    expect(saved.verificationNeeded).toBe(false);
  });

  test('signing out clears the session even when the request fails', async () => {
    const tokens = store('good', null);

    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      refreshTokenIn: 'cookie',
      fetch: async () => {
        throw new Error('offline');
      },
    });

    await client.signOut();

    expect(await tokens.access()).toBeNull();
  });
});

function health(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('recovering a password', () => {
  test('asks for a link, checks it, and resets with it, signing in', async () => {
    const sent: { path: string; body: unknown }[] = [];
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store(null, null),
      fetch: async (input, init) => {
        const path = new URL(String(input)).pathname;
        sent.push({ path, body: JSON.parse(String(init?.body)) });

        if (path === '/api/auth/password/forgot') return new Response('{}', { status: 202 });
        if (path === '/api/auth/password/reset/check') {
          return new Response(JSON.stringify({ email: 'folake@ire.events' }), { status: 200 });
        }

        return new Response(
          JSON.stringify({ accessToken: 'a', expiresIn: 900, refreshToken: 'r', account: ACCOUNT }),
          { status: 200 },
        );
      },
    });

    await client.forgotPassword('folake@ire.events');
    expect(await client.checkResetLink('t1')).toEqual({
      email: 'folake@ire.events',
      twoFactor: false,
    });
    const signedIn = await client.resetPassword('t1', 'a brand new passphrase');

    expect(signedIn.account.id).toBe(ACCOUNT.id);
    expect(sent.map((request) => request.path)).toEqual([
      '/api/auth/password/forgot',
      '/api/auth/password/reset/check',
      '/api/auth/password/reset',
    ]);
  });
});

describe('the number a code is waiting on', () => {
  const phone = (number: string, primary: boolean, pending: boolean) => ({
    id: number,
    number,
    countryCode: 'NG',
    verified: primary,
    primary,
    pending,
  });

  test('is the replacement while one is texted, else the primary, else none', () => {
    const current = phone('+2348035550142', true, false);
    const replacement = phone('+233244123456', false, true);

    expect(phoneAwaitingCode({ phoneNumbers: [current, replacement] })).toBe(replacement);
    expect(phoneAwaitingCode({ phoneNumbers: [current] })).toBe(current);
    expect(phoneAwaitingCode({ phoneNumbers: [] })).toBeNull();
  });
});

describe('which gate an account is behind', () => {
  const email = (verified: boolean) => [
    { id: 'a1', address: 'folake@ire.events', verified, primary: true },
  ];

  test('the email first, then a phone it has, then the details, then nothing', () => {
    expect(awaiting({ verified: false, complete: false, emailAddresses: email(false) })).toBe(
      'email',
    );
    expect(awaiting({ verified: false, complete: true, emailAddresses: email(true) })).toBe(
      'phone',
    );
    expect(awaiting({ verified: true, complete: false, emailAddresses: email(true) })).toBe(
      'details',
    );
    expect(awaiting({ verified: true, complete: true, emailAddresses: email(true) })).toBeNull();
  });

  test('a verified alternative address does not count for the primary', () => {
    const addresses = [
      { id: 'a1', address: 'folake@ire.events', verified: false, primary: true },
      { id: 'a2', address: 'folake@example.com', verified: true, primary: false },
    ];

    expect(awaiting({ verified: false, complete: false, emailAddresses: addresses })).toBe('email');
  });

  test('a saved account in no organisation waits on the request it made at its domain (sc-561)', () => {
    const waitingFor = { organisation: { id: 'org_1', name: 'Ìrè Events' }, askedAt: 'x' };

    expect(
      awaiting({ verified: true, complete: true, emailAddresses: email(true), waitingFor }),
    ).toBe('approval');
    expect(
      awaiting({ verified: true, complete: false, emailAddresses: email(true), waitingFor }),
    ).toBe('details');
  });
});

describe('company domain joining (sc-561)', () => {
  function answering(body: unknown, status = 200) {
    const sent: { url: string; method: string }[] = [];
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      fetch: async (input, init) => {
        sent.push({ url: String(input), method: init?.method ?? 'GET' });

        return new Response(body == null ? null : JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    return { client, sent };
  }

  test('reads the offers and the request waiting', async () => {
    const { client } = answering({
      domain: 'ire.events',
      offers: [{ id: 'org_1', name: 'Ìrè Events' }],
      request: null,
    });

    expect(await client.joinOffers()).toEqual({
      domain: 'ire.events',
      offers: [{ id: 'org_1', name: 'Ìrè Events' }],
      request: null,
    });
  });

  test('reads the list of domains, and escapes the one removed', async () => {
    const { client, sent } = answering({
      domains: [{ domain: 'ire.events', stopped: true }],
      most: 5,
      ownAddress: 'folake@ire.events',
    });

    expect(await client.removeCompanyDomain('org_1', 'ire.events')).toEqual({
      domains: [{ domain: 'ire.events', stopped: true }],
      most: 5,
      ownAddress: 'folake@ire.events',
    });
    expect(sent).toEqual([
      { url: 'http://api.test/api/orgs/org_1/domains/ire.events', method: 'DELETE' },
    ]);
  });

  test('lists the organisations the account is paused in, with why and the removal instant', async () => {
    const suspension = {
      reason: 'address_gone',
      domain: 'ire.events',
      since: { at: '2026-10-16T08:40:00+00:00', written: 'Friday, Oct 16 at 09:40 WAT' },
      removesAt: { at: '2026-11-15T08:40:00+00:00', written: 'Sunday, Nov 15 at 09:40 WAT' },
      onlyOwner: false,
    };
    const { client } = answering({
      organisations: [],
      paused: [
        {
          id: 'org_1',
          name: 'Ìrè Events',
          countryCode: 'NG',
          currency: 'NGN',
          timezone: 'Africa/Lagos',
          contactAddress: 'hello@ire.events',
          locale: 'en',
          suspension,
        },
      ],
    });

    const { paused } = await client.organisationsWithPaused();

    expect(paused[0]?.name).toBe('Ìrè Events');
    expect(paused[0]?.suspension).toEqual(suspension);
  });

  test('restores a suspended member', async () => {
    const { client, sent } = answering(null, 204);

    await client.restoreMember('org_1', 'mem_1');

    expect(sent).toEqual([
      { url: 'http://api.test/api/orgs/org_1/members/mem_1/restore', method: 'POST' },
    ]);
  });
});

describe('requests to join (sc-562)', () => {
  function answering(body: unknown, status = 200) {
    const sent: { url: string; method: string; body: unknown }[] = [];
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      fetch: async (input, init) => {
        sent.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
        });

        return new Response(body == null ? null : JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    return { client, sent };
  }

  test('sends the token in the body, never the URL, and reads only the name', async () => {
    const { client, sent } = answering({
      organisation: { name: 'Ìrè Events' },
      standing: 'cooling_off',
      askAgainFrom: '2026-11-20T09:00:00+00:00',
    });

    expect(await client.requestLinkPreview('ab12')).toEqual({
      organisation: { name: 'Ìrè Events' },
      standing: 'cooling_off',
      askAgainFrom: '2026-11-20T09:00:00+00:00',
    });
    expect(sent).toEqual([
      { url: 'http://api.test/api/request-links/link', method: 'POST', body: { token: 'ab12' } },
    ]);
  });

  test('a blank message is sent as none', async () => {
    const { client, sent } = answering(
      { request: { organisation: { id: 'org_1', name: 'Ìrè Events' }, askedAt: 'x' } },
      201,
    );

    await client.askThroughRequestLink('ab12', '   ');

    expect(sent[0]?.body).toEqual({ token: 'ab12', message: null });
  });

  test('turns the link on with a PUT and reads it in full', async () => {
    const { client, sent } = answering({ on: true, url: 'https://soirely.test/join/ab12' });

    expect(await client.turnOnRequestLink('org_1')).toEqual({
      on: true,
      url: 'https://soirely.test/join/ab12',
    });
    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toBe('http://api.test/api/orgs/org_1/request-link');
  });
});

describe('the health endpoint', () => {
  function client(response: Response) {
    return new ApiClient({ baseUrl: () => 'http://api.test', fetch: async () => response });
  }

  test('reads the object the API sends', async () => {
    const answered = await client(
      health({
        application: 'soirely-api',
        environment: 'dev',
        status: 'ok',
        checks: { postgres: { status: 'ok' }, redis: { status: 'ok' } },
      }),
    ).health();

    expect(answered.status).toBe('ok');
    expect(Object.keys(answered.checks)).toEqual(['postgres', 'redis']);
  });

  test('a degraded API answering 503 is an answer rather than a failure', async () => {
    const answered = await client(
      health(
        {
          status: 'degraded',
          checks: {
            postgres: { status: 'ok' },
            redis: { status: 'error', error: 'connection refused' },
          },
        },
        503,
      ),
    ).health();

    expect(answered.status).toBe('degraded');
    expect(answered.checks.redis).toEqual({ status: 'error', error: 'connection refused' });
  });

  test('refuses the envelope it used to answer in, naming where to look', async () => {
    await expect(
      client(health({ success: true, data: { status: 'ok', checks: {} } })).health(),
    ).rejects.toThrow(/HealthController/);
  });

  test('refuses a check that carries no status', async () => {
    await expect(
      client(health({ status: 'ok', checks: { postgres: { state: 'ok' } } })).health(),
    ).rejects.toThrow(/shape this client does not know/);
  });
});

/**
 * What AccountController sends. Written from the controller rather than from
 * memory, which is the whole lesson of the two shape mismatches above.
 */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ACCOUNT = {
  id: '018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f',
  name: 'Folake Ire',
  businessName: 'Ire Events',
  countryCode: 'NG',
  organisationCountry: null,
  locale: 'en',
  timezone: null,
  verified: true,
  complete: true,
  needsOrganisation: false,
  hasPassword: true,
  twoFactorSetupPrompt: false,
  waitingFor: null,
  providers: [],
  emailAddresses: [
    { id: 'a1', address: 'folake@ire.events', verified: true, primary: true },
    { id: 'a2', address: 'folake@example.com', verified: false, primary: false },
  ],
  phoneNumbers: [],
};

describe('who is signed in', () => {
  function client(response: Response) {
    return new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('live', null),
      fetch: async () => response,
    });
  }

  test('reads the account the API sends', async () => {
    const account = await client(json(ACCOUNT)).me();

    expect(account.name).toBe('Folake Ire');
    expect(account.businessName).toBe('Ire Events');
    expect(account.emailAddresses).toHaveLength(2);
  });

  test('the primary address is the one identified by its flag', () => {
    const reversed = [...ACCOUNT.emailAddresses].reverse();

    expect(primaryEmailAddress({ ...ACCOUNT, emailAddresses: reversed })).toBe('folake@ire.events');
  });

  test('refuses a shape it does not know, naming where to look', async () => {
    await expect(client(json({ data: ACCOUNT })).me()).rejects.toThrow(/AccountController/);
  });
});

describe('the ways an account signs in', () => {
  function client(response: Response, sent: { path: string; body: unknown }[] = []) {
    return new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('live', null),
      fetch: async (url, init) => {
        sent.push({
          path: `${init?.method ?? 'GET'} ${new URL(String(url)).pathname}`,
          body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
        });

        return response;
      },
    });
  }

  test('reads each provider with the address it vouched for, and drops one it does not know', async () => {
    const account = await client(
      json({
        ...ACCOUNT,
        providers: [
          { provider: 'google', email: 'folake.adeyemi@gmail.com' },
          { provider: 'apple', email: null },
          { provider: 'facebook', email: 'x@example.com' },
        ],
      }),
    ).me();

    expect(account.providers).toEqual([
      { provider: 'google', email: 'folake.adeyemi@gmail.com' },
      { provider: 'apple', email: null },
    ]);
  });

  test('proves it is you with the password, then the code', async () => {
    const sent: { path: string; body: unknown }[] = [];
    const proof = await client(
      json({ proof: 'p-1', expiresAt: '2026-10-17T12:05:00+00:00' }),
      sent,
    ).prove({ password: 'a decent passphrase' }, '123456');

    expect(proof).toEqual({ proof: 'p-1', expiresAt: '2026-10-17T12:05:00+00:00' });
    expect(sent).toEqual([
      { path: 'POST /api/auth/proof', body: { password: 'a decent passphrase', code: '123456' } },
    ]);
  });

  test('or with a linked provider, its sign-in sent as it came', async () => {
    const sent: { path: string; body: unknown }[] = [];

    await client(json({ proof: 'p-1', expiresAt: '' }), sent).prove({
      provider: 'google',
      signIn: { idToken: 'id', nonce: 'n' },
    });

    expect(sent[0]?.body).toEqual({
      provider: 'google',
      providerSignIn: { idToken: 'id', nonce: 'n' },
    });
  });

  test('a retried code sends the kept proof, not the spent sign-in', async () => {
    const sent: { path: string; body: unknown }[] = [];

    await client(json({ proof: 'p-2', expiresAt: '' }), sent).prove(
      { pendingProof: 'pending-1' },
      '123456',
    );

    expect(sent[0]?.body).toEqual({ pendingProof: 'pending-1', code: '123456' });
  });

  test('links and unlinks with the proof, naming this session', async () => {
    const sent: { path: string; body: unknown }[] = [];

    const linked = await client(
      json({ provider: 'apple', email: 'x7k2m9@privaterelay.appleid.com' }, 201),
      sent,
    ).linkProvider('apple', 'p-1', { handle: 'h', codeVerifier: 'v', nonce: 'n' });
    const unlinked = await client(json({ signedOut: 2, thisDevice: true }), sent).unlinkProvider(
      'apple',
      'p-1',
    );

    expect(linked).toEqual({ provider: 'apple', email: 'x7k2m9@privaterelay.appleid.com' });
    expect(unlinked).toEqual({ signedOut: 2, thisDevice: true });
    expect(sent).toEqual([
      {
        path: 'POST /api/auth/providers/apple',
        body: { proof: 'p-1', providerSignIn: { handle: 'h', codeVerifier: 'v', nonce: 'n' } },
      },
      { path: 'POST /api/auth/providers/apple/unlink', body: { proof: 'p-1' } },
    ]);
  });
});

describe('signing out everywhere else', () => {
  function client(response: Response, sent: { path: string; body: unknown }[]) {
    return new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('live', null),
      fetch: async (url, init) => {
        sent.push({
          path: `${init?.method ?? 'GET'} ${new URL(String(url)).pathname}`,
          body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
        });

        return response;
      },
    });
  }

  test('sends the proof and this session, and reads the count', async () => {
    const sent: { path: string; body: unknown }[] = [];

    const ended = await client(
      json({ signedOut: 2, thisDevice: false }),
      sent,
    ).signOutEverywhereElse('p-1', 's-1');

    expect(ended).toEqual({ signedOut: 2, thisDevice: false });
    expect(sent).toEqual([
      { path: 'POST /api/auth/sessions/others', body: { proof: 'p-1', sessionId: 's-1' } },
    ]);
  });
});

describe("the account's time zone", () => {
  test('sends the device zone on every request, and reads the list', async () => {
    const headers: (string | null)[] = [];
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('live', null),
      timeZone: () => 'Africa/Lagos',
      fetch: async (_url, init) => {
        headers.push(new Headers(init?.headers).get('X-Timezone'));

        return json({
          timezones: [
            { id: 'Africa/Lagos', city: 'Lagos', country: 'Nigeria', offset: '+01:00' },
            { id: 42 },
          ],
        });
      },
    });

    const zones = await client.timezones();

    expect(zones).toEqual([
      {
        id: 'Africa/Lagos',
        city: 'Lagos',
        ianaCity: 'Lagos',
        aliases: [],
        formerName: null,
        country: 'Nigeria',
        offset: '+01:00',
      },
    ]);
    expect(headers).toEqual(['Africa/Lagos']);
  });

  test('sends the zone and language on the request that makes the account, and on sign-in', async () => {
    const sent: { path: string; zone: string | null; language: string | null }[] = [];
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store(null, null),
      timeZone: () => 'Asia/Calcutta',
      locale: () => 'fr',
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        sent.push({
          path: new URL(String(input)).pathname,
          zone: headers.get('X-Timezone'),
          language: headers.get('Accept-Language'),
        });

        return json({ accessToken: 'a', expiresIn: 900, refreshToken: 'r', account: ACCOUNT });
      },
    });

    await client.confirmRegistration('reg', '123456');
    await client.signIn('folake@ire.events', 'a decent passphrase');

    expect(sent).toEqual([
      { path: '/api/auth/register/verify', zone: 'Asia/Calcutta', language: 'fr' },
      { path: '/api/auth/login', zone: 'Asia/Calcutta', language: 'fr' },
    ]);
  });
});

describe("the app's user agent", () => {
  test('goes on every request, the refresh included, and nothing is sent when none is given', async () => {
    const agents: (string | null)[] = [];
    const answers = [
      json({ type: 'https://soirely.com/errors/unauthenticated', status: 401 }, 401),
      json({ accessToken: 'b', expiresIn: 900, refreshToken: 'r2' }),
      json({ sessions: [] }),
    ];
    const fetch: typeof globalThis.fetch = async (_url, init) => {
      agents.push(new Headers(init?.headers).get('User-Agent'));

      return answers.shift() ?? json({ sessions: [] });
    };
    const app = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('stale', 'r1'),
      userAgent: 'Soirely/1.4.0 (iOS 18.1; iPhone)',
      fetch,
    });

    await app.sessions();
    await new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('live', null),
      fetch,
    }).sessions();

    expect(agents).toEqual([
      'Soirely/1.4.0 (iOS 18.1; iPhone)',
      'Soirely/1.4.0 (iOS 18.1; iPhone)',
      'Soirely/1.4.0 (iOS 18.1; iPhone)',
      null,
    ]);
  });
});

describe('the device a sign-in comes from', () => {
  test('sends the install identifier when the client has one, and nothing when it has not', async () => {
    const sent: (string | null)[] = [];
    const fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      sent.push(new Headers(init?.headers).get('X-Device-Id'));

      return json({ accessToken: 'a', expiresIn: 900, refreshToken: 'r', account: ACCOUNT });
    };
    const app = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store(null, null),
      device: () => '1b4e28ba-2fa1-41d2-883f-0016d3cca427',
      fetch,
    });
    const web = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store(null, null),
      fetch,
    });

    await app.signIn('folake@ire.events', 'a decent passphrase');
    await app.confirmRegistration('reg', '123456');
    await web.signIn('folake@ire.events', 'a decent passphrase');

    expect(sent).toEqual([
      '1b4e28ba-2fa1-41d2-883f-0016d3cca427',
      '1b4e28ba-2fa1-41d2-883f-0016d3cca427',
      null,
    ]);
  });
});

describe('the sessions an account has', () => {
  const SESSION = {
    id: '018f3a4c-0000-7c3d-9e1f-2a3b4c5d6e7f',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0.0.0 Safari/537.36',
    ipAddress: '102.89.33.14',
    startedAt: '2026-10-15T08:40:00+00:00',
    renewedAt: '2026-10-15T08:40:00+00:00',
    expiresAt: '2026-11-14T08:40:00+00:00',
  };

  function client(response: Response, seen: string[] = []) {
    return new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('live', null),
      fetch: async (url, init) => {
        seen.push(`${init?.method ?? 'GET'} ${String(url)}`);

        return response;
      },
    });
  }

  test('reads the list out of the object it arrives in', async () => {
    const sessions = await client(json({ sessions: [SESSION] })).sessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.ipAddress).toBe('102.89.33.14');
  });

  /** A client that named itself nothing is a row that says so, not a crash. */
  test('keeps an absent user agent as nothing rather than inventing one', async () => {
    const sessions = await client(
      json({ sessions: [{ ...SESSION, userAgent: null, ipAddress: null }] }),
    ).sessions();

    expect(sessions[0]?.userAgent).toBeNull();
    expect(sessions[0]?.ipAddress).toBeNull();
  });

  test('refuses a bare array, which is not what the endpoint sends', async () => {
    await expect(client(json([SESSION])).sessions()).rejects.toThrow(/AccountController/);
  });

  test('ends one by id, with the id in the path', async () => {
    const seen: string[] = [];

    await client(new Response(null, { status: 204 }), seen).endSession(SESSION.id);

    expect(seen).toEqual([`DELETE http://api.test/api/auth/sessions/${SESSION.id}`]);
  });
});

describe('verifying an address', () => {
  function client(response: Response, sent: string[] = []) {
    return {
      api: new ApiClient({
        baseUrl: () => 'http://api.test',
        tokens: store('live', null),
        fetch: async (url, init) => {
          sent.push(`${init?.method ?? 'GET'} ${new URL(String(url)).pathname}`);

          return response;
        },
      }),
      sent,
    };
  }

  test('posts the code and reads the address back', async () => {
    const { api, sent } = client(
      json({ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }),
    );

    const address = await api.verifyEmail('123456');

    expect(address.verified).toBe(true);
    expect(address.address).toBe('folake@ire.events');
    expect(sent).toEqual(['POST /api/auth/verify/email']);
  });

  test('refuses a shape it does not know, naming where to look', async () => {
    await expect(client(json({ ok: true })).api.verifyEmail('123456')).rejects.toThrow(
      /VerificationController/,
    );
  });

  test('a resend answers with the seconds until the next one', async () => {
    const { api } = client(json({ cooldownSeconds: 60 }));

    expect(await api.resendVerification()).toBe(60);
  });

  test('a resend with nothing to say counts down from zero rather than from NaN', async () => {
    const { api } = client(json({}));

    expect(await api.resendVerification()).toBe(0);
  });

  test('the cooldown and the code state are read with a GET, which spends nothing', async () => {
    const { api, sent } = client(json({ cooldownSeconds: 42, codeState: 'exhausted' }));

    expect(await api.verificationOpening()).toEqual({
      cooldownSeconds: 42,
      codeState: 'exhausted',
    });
    expect(sent).toEqual(['GET /api/auth/verify/resend']);
  });

  test('a code state it does not know reads as live, so the field still shows', async () => {
    const { api } = client(json({ cooldownSeconds: 0, codeState: 'something-new' }));

    expect(await api.verificationOpening()).toEqual({ cooldownSeconds: 0, codeState: 'live' });
  });
});

describe('a second factor', () => {
  test('a challenge saves no tokens and says whose code it is', async () => {
    const tokens = store(null, null);
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      fetch: async () =>
        json(
          {
            twoFactorChallenge: 'the-challenge',
            challengeExpiresAt: '2026-10-17T12:05:00+00:00',
            email: 'ada@example.com',
          },
          202,
        ),
    });

    const outcome = await client.signIn('ada@example.com', 'a decent passphrase');

    expect(outcome).toEqual({
      kind: 'twoFactor',
      challenge: 'the-challenge',
      expiresAt: '2026-10-17T12:05:00+00:00',
      email: 'ada@example.com',
    });
    expect(tokens.saved).toBeNull();
  });

  test('the code then signs in, and only then are tokens saved', async () => {
    const tokens = store(null, null);
    let sent: unknown = null;
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens,
      fetch: async (input, init) => {
        expect(new URL(String(input)).pathname).toBe('/api/auth/two-factor/verify');
        sent = JSON.parse(String(init?.body));
        return issued({ account: ACCOUNT });
      },
    });

    const signedIn = await client.verifyTwoFactor('the-challenge', { recoveryCode: 'abcd-efgh' });

    expect(sent).toMatchObject({ challenge: 'the-challenge', recoveryCode: 'abcd-efgh' });
    expect(signedIn.account.id).toBe(ACCOUNT.id);
    expect(tokens.saved).toMatchObject({ accessToken: 'fresh' });
  });
});

describe('getting back in without the second factor', () => {
  const WAITING = {
    status: 'waiting',
    email: 'folake@ire.events',
    phone: '+2348035550142',
    organisations: ['Ìrè Events'],
    askedAt: '2026-10-17T13:20:00+00:00',
    asked: 'Saturday, Oct 17 at 14:20 WAT',
    expiresAt: '2026-10-24T13:20:00+00:00',
    expires: 'Saturday, Oct 24 at 14:20 WAT',
    codes: null,
  };

  test('sends both codes with the handle, and never a session token', async () => {
    const sent: { path: string; body: unknown; auth: string | null }[] = [];
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      tokens: store('stale', null),
      fetch: async (input, init) => {
        sent.push({
          path: new URL(String(input)).pathname,
          body: JSON.parse(String(init?.body)),
          auth: new Headers(init?.headers).get('Authorization'),
        });

        return json({ state: WAITING });
      },
    });

    const state = await client.proveRecovery('handle', '481920', '305117');

    expect(state.expires).toBe('Saturday, Oct 24 at 14:20 WAT');
    expect(sent).toEqual([
      {
        path: '/api/auth/two-factor/recovery/prove',
        body: { recovery: 'handle', emailCode: '481920', phoneCode: '305117' },
        auth: null,
      },
    ]);
  });

  test('reads whether anybody is left to answer a waiting request', async () => {
    const answering = (state: object) =>
      new ApiClient({ baseUrl: () => 'http://api.test', fetch: async () => json({ state }) });

    expect((await answering(WAITING).recoveryState('handle')).nobody).toBe(false);
    expect(
      (await answering({ ...WAITING, organisations: [], nobody: true }).recoveryState('handle'))
        .nobody,
    ).toBe(true);
  });

  test('reads the start screen, and an open request to carry on with', async () => {
    const proving = {
      ...WAITING,
      status: 'proving',
      codes: { state: 'live', cooldownSeconds: 42, route: 'whatsapp' },
    };
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      fetch: async () =>
        json({
          email: 'folake@ire.events',
          phone: null,
          organisations: ['Ìrè Events'],
          nobody: false,
          supportAddress: 'support@soirely.com',
          recovery: 'resumed',
          state: proving,
        }),
    });

    const opening = await client.recoveryOpening('challenge');

    expect(opening.open?.recovery).toBe('resumed');
    expect(opening.open?.state.codes).toEqual({
      state: 'live',
      cooldownSeconds: 42,
      route: 'whatsapp',
    });
    expect(opening.supportAddress).toBe('support@soirely.com');
  });

  test('refuses a step it cannot read, naming where to look', async () => {
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      fetch: async () => json({ state: { status: 'odd' } }),
    });

    await expect(client.recoveryState('handle')).rejects.toThrow(/RecoveryView/);
  });
});

describe('invitations and members', () => {
  function client(response: Response, sent: { line: string; body: unknown }[] = []) {
    return {
      api: new ApiClient({
        baseUrl: () => 'http://api.test',
        tokens: store('live', null),
        refreshTokenIn: 'cookie',
        fetch: async (url, init) => {
          sent.push({
            line: `${init?.method ?? 'GET'} ${new URL(String(url)).pathname}`,
            body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
          });

          return response;
        },
      }),
      sent,
    };
  }

  // Every key MemberSerialiser and InvitationsController write, with the values they write.
  const PREVIEW = {
    id: 'inv_1',
    organisation: { id: 'org_1', name: 'Ìrè Events' },
    email: 'kemi.l@gmail.com',
    role: { id: 'role_3', seededAs: 'event_manager', name: null },
    invitedBy: { name: 'Bisi Adeyemi' },
    expiresAt: '2026-10-23T09:00:00+00:00',
    refusal: null,
    forYou: null,
    signedInAs: null,
  };

  test('a link opens on who invited whom, to what, until when', async () => {
    const { api, sent } = client(json(PREVIEW));

    expect(await api.invitationLink('ab12')).toEqual(PREVIEW);
    expect(sent).toEqual([{ line: 'POST /api/invitations/link', body: { token: 'ab12' } }]);
  });

  test("a deleted organisation's invitation keeps the name and loses the id", async () => {
    const { api } = client(
      json({
        ...PREVIEW,
        organisation: { id: null, name: 'Ìrè Events' },
        role: null,
        refusal: 'organisation_deleted',
      }),
    );

    const preview = await api.invitationLink('ab12');

    expect(preview.organisation).toEqual({ id: null, name: 'Ìrè Events' });
    expect(preview.refusal).toBe('organisation_deleted');
  });

  test('registering from a link sends the token and is signed in at once', async () => {
    const { api, sent } = client(
      new Response(
        JSON.stringify({
          accessToken: 'fresh',
          refreshExpiresAt: '2026-11-14T00:00:00+00:00',
          sessionId: 's1',
          account: {
            id: 'u1',
            name: 'Kemi Lawal',
            verified: true,
            complete: true,
            emailAddresses: [
              { id: 'e1', address: 'kemi.l@gmail.com', verified: true, primary: true },
            ],
            phoneNumbers: [],
          },
        }),
        { status: 201 },
      ),
    );

    const signedIn = await api.registerFromInvitation(
      'ab12',
      'kemi.l@gmail.com',
      'Kemi Lawal',
      'a long enough passphrase',
    );

    expect(signedIn.account.verified).toBe(true);
    expect(sent[0]?.line).toBe('POST /api/auth/register');
    expect(sent[0]?.body).toMatchObject({ invitationToken: 'ab12', refreshTokenIn: 'cookie' });
  });

  test('a refused link arrives as its code', async () => {
    const { api } = client(problem(403, 'invitation_not_yours'));

    const refused = await api
      .registerFromInvitation('ab12', 'bob@example.com', 'Bob', 'a long enough passphrase')
      .catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(ApiError);
    expect((refused as ApiError).is('invitation_not_yours')).toBe(true);
  });

  test('the members list reads every state and its history', async () => {
    const { api, sent } = client(
      json({
        members: [
          {
            id: 'm1',
            user: { id: 'u1', name: 'Kemi Lawal', email: 'kemi.l@gmail.com' },
            role: { id: 'role_4', seededAs: 'coordinator', name: null },
            status: 'left_or_removed',
            former: 'removed',
            channel: 'invitation',
            since: '2026-10-18T10:00:00+00:00',
            invitedBy: { id: 'u2', name: 'Bisi Adeyemi' },
            invitedAt: '2026-10-01T10:00:00+00:00',
            self: false,
            history: [
              {
                from: null,
                to: 'active',
                channel: 'invitation',
                by: { id: 'u1', name: 'Kemi Lawal' },
                at: '2026-10-02T10:00:00+00:00',
              },
              {
                from: 'active',
                to: 'left_or_removed',
                channel: 'invitation',
                by: { id: 'u2', name: 'Bisi Adeyemi' },
                at: '2026-10-18T10:00:00+00:00',
              },
            ],
          },
        ],
        invitations: [
          {
            id: 'inv_1',
            email: 'amara@example.com',
            role: { id: 'role_5', seededAs: 'read_only', name: null },
            invitedBy: { id: 'u2', name: 'Bisi Adeyemi' },
            status: 'pending',
            sentAt: '2026-10-18T10:00:00+00:00',
            expiresAt: '2026-10-25T10:00:00+00:00',
            acceptedAt: null,
            declinedAt: null,
            revokedAt: null,
          },
        ],
      }),
    );

    const list = await api.members('org_1');

    expect(list.members[0]?.former).toBe('removed');
    expect(list.members[0]?.history.map((step) => step.to)).toEqual(['active', 'left_or_removed']);
    expect(list.invitations[0]?.status).toBe('pending');
    expect(sent[0]?.line).toBe('GET /api/orgs/org_1/members');
  });

  test('a members list in a shape it does not know names where to look', async () => {
    await expect(
      client(json({ members: [{ id: 'm1' }], invitations: [] })).api.members('o'),
    ).rejects.toThrow(/MembersController/);
  });

  test('an invitation is sent with the address and the role', async () => {
    const { api, sent } = client(
      json({
        invitation: {
          id: 'inv_2',
          email: 'amara@example.com',
          role: { id: 'role_5', seededAs: 'read_only', name: null },
          invitedBy: { id: 'u2', name: 'Bisi Adeyemi' },
          status: 'pending',
          sentAt: null,
          expiresAt: '2026-10-25T10:00:00+00:00',
          acceptedAt: null,
          declinedAt: null,
          revokedAt: null,
        },
      }),
    );

    const sentInvitation = await api.inviteMember('org_1', 'amara@example.com', 'role_5');

    expect(sentInvitation.id).toBe('inv_2');
    expect(sent[0]).toEqual({
      line: 'POST /api/orgs/org_1/members/invite',
      body: { email: 'amara@example.com', roleId: 'role_5' },
    });
  });

  test('a role change and a transfer each say which membership they move', async () => {
    const { api, sent } = client(new Response(null, { status: 204 }));

    await api.changeMemberRole('org_1', 'm_bisi', 'role_5');
    await api.transferOwnership('org_1', 'm_bisi', 'p_1');

    expect(sent).toEqual([
      { line: 'PATCH /api/orgs/org_1/members/m_bisi', body: { roleId: 'role_5' } },
      { line: 'POST /api/orgs/org_1/ownership', body: { membershipId: 'm_bisi', proof: 'p_1' } },
    ]);
  });

  test('somebody awaiting approval carries the instant they are removed, as the server wrote it', async () => {
    const { api } = client(
      json({
        members: [
          {
            id: 'm_ada',
            user: { id: 'u3', name: 'Ada Okeke', email: 'ada@okeke.ng' },
            role: { id: 'role_5', seededAs: 'read_only', name: null },
            status: 'pending_approval',
            former: null,
            channel: 'request',
            message: null,
            since: '2026-10-12T08:40:00+00:00',
            removesAt: {
              at: '2026-11-11T08:40:00+00:00',
              written: 'Wednesday, Nov 11 at 09:40 WAT',
            },
            invitedBy: null,
            invitedAt: null,
            self: false,
            history: [],
          },
        ],
        invitations: [],
      }),
    );

    const [ada] = (await api.members('org_1')).members;

    expect(ada?.removesAt).toEqual({
      at: '2026-11-11T08:40:00+00:00',
      written: 'Wednesday, Nov 11 at 09:40 WAT',
    });
  });

  test('a request to join is approved with a role, or turned down', async () => {
    const { api, sent } = client(new Response(null, { status: 204 }));

    await api.approveMember('org_1', 'm_ada', 'role_5');
    await api.turnDownMember('org_1', 'm_chidi');

    expect(sent).toEqual([
      { line: 'POST /api/orgs/org_1/members/m_ada/approve', body: { roleId: 'role_5' } },
      { line: 'POST /api/orgs/org_1/members/m_chidi/turn-down', body: {} },
    ]);
  });

  test('a deletion keeps the deadline as the server wrote it for the reader', async () => {
    const { api, sent } = client(
      json({
        deletedAt: '2026-10-17T13:20:00+00:00',
        restoreClosesAt: '2026-11-16T13:20:00+00:00',
        restoreCloses: 'Monday, Nov 16 at 14:20 WAT',
      }),
    );

    const deletion = await api.deleteOrganisation('org_1', 'Ìrè Events');

    expect(deletion.restoreCloses).toBe('Monday, Nov 16 at 14:20 WAT');
    expect(sent[0]).toEqual({ line: 'DELETE /api/orgs/org_1', body: { name: 'Ìrè Events' } });
  });
});

describe('events (sc-1486)', () => {
  // Every key the API's event serialisation writes, as the sc-1486 contract states it.
  const EVENT = {
    id: '0199f0aa-1111-7000-8000-000000000001',
    organisationId: 'org_1',
    name: 'Adaeze and Tunde',
    status: 'draft',
    startsAt: '2026-11-14T16:00:00+01:00',
    endsAt: '2026-11-15T02:00:00+01:00',
    timeZone: 'Africa/Lagos',
    currency: 'NGN',
    createdAt: '2026-10-21T09:00:00+00:00',
  };

  function client(response: () => Response, sent: { line: string; body: unknown }[] = []) {
    return {
      api: new ApiClient({
        baseUrl: () => 'http://api.test',
        tokens: store('live', null),
        refreshTokenIn: 'cookie',
        fetch: async (url, init) => {
          sent.push({
            line: `${init?.method ?? 'GET'} ${new URL(String(url)).pathname}`,
            body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
          });

          return response();
        },
      }),
      sent,
    };
  }

  test("an organisation's events are listed in the order the API gives", async () => {
    const later = { ...EVENT, id: 'e2', name: 'Later' };
    const { api, sent } = client(() => json({ events: [EVENT, later] }));

    const events = await api.events('org_1');

    expect(events.map(({ name }) => name)).toEqual(['Adaeze and Tunde', 'Later']);
    expect(events[0]).toEqual(EVENT);
    expect(sent[0]?.line).toBe('GET /api/orgs/org_1/events');
  });

  test('an event is created with local times and its zone, and read by its id', async () => {
    const { api, sent } = client(() => json({ event: EVENT }, 201));
    const body = {
      name: 'Adaeze and Tunde',
      startsAt: '2026-11-14T16:00',
      endsAt: '2026-11-15T02:00',
      timeZone: 'Africa/Lagos',
      currency: 'NGN',
    };

    expect(await api.createEvent('org_1', body)).toEqual(EVENT);
    expect(await api.event(EVENT.id)).toEqual(EVENT);
    expect(sent).toEqual([
      { line: 'POST /api/orgs/org_1/events', body },
      { line: `GET /api/events/${EVENT.id}`, body: null },
    ]);
  });

  test('an event in a shape it does not know, or a status it does not know, is an error', async () => {
    await expect(
      client(() => json({ events: [{ ...EVENT, status: 'live' }] })).api.events('org_1'),
    ).rejects.toThrow(/events controller/);
    await expect(
      client(() => json({ event: { ...EVENT, timeZone: undefined } })).api.event('e1'),
    ).rejects.toThrow(/events controller/);
  });

  test('a refused create carries its violations by field', async () => {
    const { api } = client(() =>
      problem(422, 'validation_failed', {
        violations: [
          {
            propertyPath: 'endsAt',
            message: 'The end is before the start. Choose a later end.',
            code: 'end_before_start',
          },
        ],
      }),
    );

    await api
      .createEvent('org_1', {
        name: 'X',
        startsAt: '2026-11-14T16:00',
        endsAt: '2026-11-14T15:00',
        timeZone: 'Africa/Lagos',
        currency: 'NGN',
      })
      .catch((error: ApiError) => {
        expect(error.fieldErrors()).toEqual({
          endsAt: 'The end is before the start. Choose a later end.',
        });
      });
    expect.assertions(1);
  });
});

describe('claiming an organisation with no active owner (sc-6640)', () => {
  function answering(body: unknown, status = 200) {
    const sent: { url: string; method: string; body: unknown }[] = [];
    const client = new ApiClient({
      baseUrl: () => 'http://api.test',
      fetch: async (input, init) => {
        sent.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
        });

        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    return { client, sent };
  }

  const when = { at: '2026-10-27T09:00:00+00:00', written: 'Tuesday 27 Oct at 10:00 WAT' };
  // Every key OwnerClaimDescriber writes; OwnerClaimTest asserts the same list on the server.
  const claim = {
    id: 'claim_1',
    claimant: { id: 'u_bisi', name: 'Bisi', email: 'bisi@ire.events' },
    mine: true,
    domain: 'ire.events',
    record: { type: 'TXT', name: '_soirely-verify.ire.events', value: 'soirely-claim=abc' },
    startedAt: when,
    lapsesAt: when,
    foundAt: null,
    passesAt: null,
  };

  test('reads the banner with the claimant’s record', async () => {
    const banner = { state: 'open', domain: 'ire.events', claim, stopped: null, lapsed: null };
    const { client, sent } = answering({ ownerClaim: banner });

    expect(await client.startOwnerClaim('org_1')).toEqual(banner);
    expect(sent).toEqual([
      {
        url: 'http://api.test/api/orgs/org_1/owner-claim',
        method: 'POST',
        body: {},
      },
    ]);
  });

  test('reads no banner as null, and a shape it does not know as an error', async () => {
    expect(await answering({ ownerClaim: null }).client.ownerClaim('org_1')).toBeNull();
    await expect(
      answering({ ownerClaim: { state: 'odd' } }).client.ownerClaim('org_1'),
    ).rejects.toThrow(/OwnerClaimDescriber/);
  });

  test('says whether Check record found it', async () => {
    const banner = {
      state: 'found',
      domain: 'ire.events',
      claim: { ...claim, foundAt: when, passesAt: when },
      stopped: null,
      lapsed: null,
    };
    const { client } = answering({ ownerClaim: banner, found: true });

    expect(await client.checkOwnerClaim('org_1')).toEqual({ ownerClaim: banner, found: true });
  });
});
