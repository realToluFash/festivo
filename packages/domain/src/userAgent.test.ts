import { describe, expect, it } from 'vitest';

import { appDevice, appUserAgent, readableAgent } from './userAgent.ts';

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

describe("the app's own user agent", () => {
  it('names the OS and the device class, and reads back as the same device', () => {
    const cases: [Parameters<typeof appUserAgent>[0], string, string][] = [
      [
        { version: '1.4.0', platform: 'ios', osName: 'iOS', osVersion: '18.1', tablet: false },
        'Soirely/1.4.0 (iOS 18.1; iPhone)',
        'iPhone',
      ],
      [
        { version: '1.4.0', platform: 'ios', osName: 'iPadOS', osVersion: '18.1', tablet: true },
        'Soirely/1.4.0 (iPadOS 18.1; iPad)',
        'iPad',
      ],
      [
        {
          version: '1.4.0',
          platform: 'android',
          osName: 'POCO/vayu_eea',
          osVersion: '15',
          tablet: false,
        },
        'Soirely/1.4.0 (Android 15; phone)',
        'phone',
      ],
      [
        { version: '1.4.0', platform: 'android', osName: null, osVersion: '15', tablet: true },
        'Soirely/1.4.0 (Android 15; tablet)',
        'tablet',
      ],
    ];

    for (const [parts, agent, device] of cases) {
      expect(appUserAgent(parts)).toBe(agent);
      expect(appDevice(agent)).toBe(device);
      expect(readableAgent(agent)).toBeNull();
    }
  });

  it('reads only the whole format, never a Soirely prefix with something else after it', () => {
    expect(appDevice('Soirely/1.0 (+https://soirely.com)')).toBeNull();
    expect(appDevice('Soirely/1.4.0 (Android 15; watch)')).toBeNull();
    expect(appDevice('Soirely/1.4.0 (iOS 18.1; iPhone) extra')).toBeNull();
    expect(appDevice('Soirely-QA/1.0 (iOS 18.1; iPhone)')).toBeNull();
    expect(
      appDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Safari/604.1'),
    ).toBeNull();
    expect(appDevice(null)).toBeNull();
  });
});
