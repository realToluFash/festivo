import { describe, expect, test } from 'vitest';

import { tokens } from './tokens.ts';

describe('the access token is held in memory and nowhere else', () => {
  test('it is given back, and forgotten on sign-out', async () => {
    tokens.save({
      accessToken: 'an-access-token',
      refreshExpiresAt: '2026-11-14T00:00:00+00:00',
      sessionId: '018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f',
    });

    expect(await tokens.access()).toBe('an-access-token');

    await tokens.clear();

    expect(await tokens.access()).toBeNull();
  });

  /**
   * The guard. Persisting the access token is the obvious-looking fix for
   * losing it on reload, and it would undo the reason it is held here: browser
   * storage is readable by any script that reaches this page, and the token
   * stays valid for fifteen minutes wherever it is taken.
   */
  test('nothing reaches browser storage', async () => {
    localStorage.clear();
    sessionStorage.clear();

    tokens.save({
      accessToken: 'an-access-token',
      refreshToken: 'should-not-exist-here-either',
      refreshExpiresAt: '2026-11-14T00:00:00+00:00',
      sessionId: '018f3a4c-7b2e-7c3d-9e1f-2a3b4c5d6e7f',
    });

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');

    await tokens.clear();
  });

  test('the refresh token is not this file to hand out', async () => {
    expect(await tokens.refresh()).toBeNull();
  });
});
