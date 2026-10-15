import { describe, expect, it } from 'vitest';

import { readableAgent } from './userAgent.ts';

/**
 * Real strings, from the clients this product actually has. Every Chromium
 * browser claims to be Chrome and Safari, and Chrome claims to be Safari, so
 * the order of the tests below is the thing being protected.
 */
describe('reading a user agent', () => {
  const cases: [string, string, string, string][] = [
    [
      'Chrome on macOS',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'Chrome',
      'macOS',
    ],
    [
      'Safari on iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      'Safari',
      'iPhone',
    ],
    [
      'Edge on Windows, which also claims to be Chrome and Safari',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      'Edge',
      'Windows',
    ],
    [
      'Firefox on Linux',
      'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
      'Firefox',
      'Linux',
    ],
    [
      'Chrome on iOS, which calls itself CriOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1',
      'Chrome',
      'iPhone',
    ],
    [
      'Samsung Internet on Android',
      'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
      'Samsung Internet',
      'Android',
    ],
  ];

  for (const [name, agent, browser, platform] of cases) {
    it(`reads ${name}`, () => {
      expect(readableAgent(agent)).toEqual({ browser, platform });
    });
  }

  /**
   * The design's rule: a string this cannot read is shown as it came, because
   * a session nobody can identify is the one most worth looking at. Null says
   * "nothing to read", and the screen shows the raw string instead.
   */
  it('gives up on a string it cannot read, rather than guessing', () => {
    expect(readableAgent('Soirely/1.0 (+https://soirely.com)')).toBeNull();
    expect(readableAgent('curl/8.7.1')).toBeNull();
    expect(readableAgent('okhttp/4.12.0')).toBeNull();
  });

  it('treats nothing at all as nothing to read', () => {
    expect(readableAgent(null)).toBeNull();
    expect(readableAgent(undefined)).toBeNull();
    expect(readableAgent('   ')).toBeNull();
  });
});
