import type { DeviceSession } from '@soirely/api-client';
import { type TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { deviceName } from './devices.ts';

const t = ((key: string, values?: Record<string, string>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

function device(userAgent: string | null): DeviceSession {
  return {
    id: 'one',
    thisDevice: false,
    userAgent,
    ipAddress: null,
    startedAt: '2026-10-17T09:00:00Z',
    renewedAt: '2026-10-17T09:00:00Z',
    expiresAt: '2026-11-16T09:00:00Z',
  };
}

describe('the devices card in the app', () => {
  it('names a device it can read, and shows one it cannot as it came', () => {
    expect(
      deviceName(
        device(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        ),
        t,
      ),
    ).toBe('devices.agent {"browser":"Safari","platform":"iPhone"}');
    expect(deviceName(device('okhttp/4.12.0'), t)).toBe('okhttp/4.12.0');
    expect(deviceName(device(null), t)).toBe('devices.unknownDevice');
  });

  it('names the app by its device class, and shows any other Soirely string as it came', () => {
    expect(deviceName(device('Soirely/1.4.0 (iOS 18.1; iPhone)'), t)).toBe('devices.appIPhone');
    expect(deviceName(device('Soirely/1.4.0 (iPadOS 18.1; iPad)'), t)).toBe('devices.appIPad');
    expect(deviceName(device('Soirely/1.4.0 (Android 15; phone)'), t)).toBe(
      'devices.appAndroidPhone',
    );
    expect(deviceName(device('Soirely/1.4.0 (Android 15; tablet)'), t)).toBe(
      'devices.appAndroidTablet',
    );
    expect(deviceName(device('Soirely/1.4.0 (Android 15; watch)'), t)).toBe(
      'Soirely/1.4.0 (Android 15; watch)',
    );
  });
});
