import { ApiError, type DeviceSession } from '@soirely/api-client';
import { type TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { deviceName, everywhereRefusal } from './devices.ts';

const t = ((key: string, values?: Record<string, string>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

function device(userAgent: string | null): DeviceSession {
  return {
    id: 'one',
    userAgent,
    ipAddress: null,
    startedAt: '2026-10-17T09:00:00Z',
    renewedAt: '2026-10-17T09:00:00Z',
    expiresAt: '2026-11-16T09:00:00Z',
  };
}

function refused(code: string, status: number): ApiError {
  const problem = { type: `https://soirely.com/errors/${code}`, title: 'No.', status };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status }));
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

  it('puts a wrong password on the password field, unless Google or Apple refused', () => {
    expect(everywhereRefusal(refused('invalid_credentials', 401), false, t)).toEqual({
      kind: 'field',
      field: 'password',
      message: 'devices.everywherePasswordWrong',
    });
    expect(everywhereRefusal(refused('invalid_credentials', 401), true, t)).toEqual({
      kind: 'failed',
      message: 'devices.everywhereFailedBody',
    });
  });

  it('puts a wrong code on the code field, and carries a limit as it came', () => {
    expect(everywhereRefusal(refused('recovery_code_used', 422), true, t)).toEqual({
      kind: 'field',
      field: 'code',
      message: 'devices.everywhereCodeWrong',
    });
    expect(everywhereRefusal(refused('too_many_attempts', 429), false, t)).toEqual({
      kind: 'limited',
      until: null,
    });
  });
});
