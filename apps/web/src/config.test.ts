import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config, load } from './config.ts';

/**
 * Boot configuration, and every way it can be wrong.
 *
 * The failure this guards against is specific and has happened: a client
 * talking to the wrong host with no error anywhere. So the tests are mostly
 * about refusing rather than succeeding.
 */
describe('runtime configuration', () => {
  beforeEach(() => {
    __setConfig(null);
  });

  function respond(body: unknown, status = 200): typeof fetch {
    return (async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;
  }

  it('reads the API base URL from the file rather than from the bundle', async () => {
    await load(respond({ apiBaseUrl: 'https://api.soirely.com' }));

    expect(config().apiBaseUrl).toBe('https://api.soirely.com');
  });

  /**
   * The point of the whole mechanism: the same code, loaded twice against
   * different files, talks to different hosts. A baked value could not do this.
   */
  it('produces a different base URL for a different file, with no rebuild', async () => {
    await load(respond({ apiBaseUrl: 'https://staging.soirely.com' }));
    expect(config().apiBaseUrl).toBe('https://staging.soirely.com');

    await load(respond({ apiBaseUrl: 'https://api.soirely.com' }));
    expect(config().apiBaseUrl).toBe('https://api.soirely.com');
  });

  it('strips a trailing slash, so paths do not double up', async () => {
    await load(respond({ apiBaseUrl: 'https://api.soirely.com/' }));

    expect(config().apiBaseUrl).toBe('https://api.soirely.com');
  });

  it('refuses a file with no apiBaseUrl rather than defaulting', async () => {
    await expect(load(respond({ mercureUrl: 'https://m.soirely.com' }))).rejects.toThrow(
      /no apiBaseUrl/,
    );
  });

  it('refuses an empty apiBaseUrl, which would make every request relative', async () => {
    await expect(load(respond({ apiBaseUrl: '' }))).rejects.toThrow(/no apiBaseUrl/);
  });

  it('names the file and the fix when it is missing', async () => {
    await expect(load(respond('not found', 404))).rejects.toThrow(/config\.json \(404\)/);
  });

  /**
   * Reading configuration mid-render would otherwise yield `undefined` in every
   * request URL, and the browser's error for that names neither the key nor the
   * file.
   */
  it('throws a diagnosable error when read before load finished', () => {
    expect(() => config()).toThrow(/before load\(\) finished/);
  });

  it('defaults the optional fields rather than refusing', async () => {
    await load(respond({ apiBaseUrl: 'https://api.soirely.com' }));

    expect(config().mercureUrl).toBe('');
    expect(config().environment).toBe('unknown');
  });
});
