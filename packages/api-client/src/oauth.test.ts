import { describe, expect, test } from 'vitest';

import {
  ProviderCancelled,
  appleName,
  callbackParam,
  ProviderFailed,
  authorizationUrl,
  base64Url,
  codeFromCallback,
  exchangeCode,
  hex,
} from './oauth.ts';

const ENDPOINTS = {
  authorizeUrl: 'http://localhost:8089/google/authorize',
  tokenUrl: 'http://localhost:8089/google/token',
  clientId: 'soirely-web',
};

describe('the provider flow', () => {
  test('asks for a code with PKCE, sending the nonce only as its hash', () => {
    const url = new URL(
      authorizationUrl(ENDPOINTS, {
        redirectUri: 'http://localhost:5173/oauth/google',
        state: 'the-state',
        nonceHash: 'abc123',
        codeChallenge: 'challenge',
      }),
    );

    expect(url.origin + url.pathname).toBe(ENDPOINTS.authorizeUrl);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'soirely-web',
      response_type: 'code',
      scope: 'openid email profile',
      state: 'the-state',
      nonce: 'abc123',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
    });
  });

  test('takes the code from the callback only when the state is ours', () => {
    expect(codeFromCallback('http://x/oauth/google?code=c1&state=s1', 's1')).toBe('c1');
    expect(() => codeFromCallback('http://x/oauth/google?code=c1&state=forged', 's1')).toThrow(
      ProviderFailed,
    );
  });

  test('reads an app callback, which has a scheme of its own', () => {
    expect(codeFromCallback('soirely://oauth/google?state=s1&code=a%2Fb', 's1')).toBe('a/b');
  });

  test('reads a refusal as a cancellation, and any other error as a failure', () => {
    expect(() => codeFromCallback('http://x/cb?error=access_denied&state=s1', 's1')).toThrow(
      ProviderCancelled,
    );
    expect(() => codeFromCallback('http://x/cb?error=server_error&state=s1', 's1')).toThrow(
      ProviderFailed,
    );
  });

  test('exchanges the code and its verifier for the ID token', async () => {
    let sent = '';
    const idToken = await exchangeCode(
      ENDPOINTS,
      { code: 'c1', codeVerifier: 'v1', redirectUri: 'http://localhost:5173/oauth/google' },
      async (_input, init) => {
        sent = String(init?.body);

        return new Response(JSON.stringify({ id_token: 'the.id.token' }), { status: 200 });
      },
    );

    expect(idToken).toBe('the.id.token');
    expect(Object.fromEntries(new URLSearchParams(sent))).toMatchObject({
      grant_type: 'authorization_code',
      code: 'c1',
      code_verifier: 'v1',
      client_id: 'soirely-web',
    });
  });

  test('fails when the provider will not exchange', async () => {
    await expect(
      exchangeCode(
        ENDPOINTS,
        { code: 'c1', codeVerifier: 'v1', redirectUri: 'x' },
        async () => new Response('{}', { status: 400 }),
      ),
    ).rejects.toThrow(ProviderFailed);
  });

  test('encodes bytes the way PKCE and the nonce hash want', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0x00, 0x10]);

    expect(base64Url(bytes)).toBe('-_8AEA');
    expect(hex(bytes)).toBe('fbff0010');
  });

  test("asks Apple for its own scope and form_post, without Google's prompt", () => {
    const url = new URL(
      authorizationUrl(ENDPOINTS, {
        redirectUri: 'http://api/return',
        state: 's',
        nonceHash: 'h',
        codeChallenge: 'c',
        scope: 'openid name email',
        extra: { response_mode: 'form_post' },
      }),
    );

    expect(url.searchParams.get('scope')).toBe('openid name email');
    expect(url.searchParams.get('response_mode')).toBe('form_post');
    expect(url.searchParams.has('prompt')).toBe(false);
  });

  test('reads the name Apple sends once, and nothing when it sends none', () => {
    expect(appleName('{"name":{"firstName":"Ada","lastName":"Lovelace"}}')).toBe('Ada Lovelace');
    expect(appleName('{"email":"x@privaterelay.appleid.com"}')).toBeUndefined();
    expect(appleName('not json')).toBeUndefined();
    expect(appleName(null)).toBeUndefined();
    expect(callbackParam('http://x/oauth/apple?code=c&user=%7B%7D', 'user')).toBe('{}');
  });
});
