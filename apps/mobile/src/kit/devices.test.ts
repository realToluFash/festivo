import { ApiError, type DeviceSession } from '@soirely/api-client';
import { type TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { deviceName, everywhereButton, everywhereRefusal, liftsIn } from './devices.ts';

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

  describe("which button proving it's you before signing out everywhere else draws", () => {
    const step = {
      providerName: 'Google',
      confirmed: false,
      codeAsked: false,
      working: false,
      refusal: null,
      until: null,
      keepsThisDevice: true,
      count: 2,
    };
    const limited = { kind: 'limited', until: new Date('2026-10-30T14:35:00Z') } as const;

    it("draws Google's button before Google and while the app checks what Google brought back", () => {
      const google = {
        kind: 'provider',
        label: 'devices.everywhereContinueWith {"provider":"Google"}',
        off: false,
      };

      expect(everywhereButton(step, t)).toEqual(google);
      expect(everywhereButton({ ...step, confirmed: true, working: true }, t)).toEqual(google);
    });

    it("keeps Google's button and its words, off, when a limit comes back before the code step", () => {
      expect(
        everywhereButton({ ...step, confirmed: true, refusal: limited, until: '14:35' }, t),
      ).toEqual({
        kind: 'provider',
        label: 'devices.everywhereContinueWith {"provider":"Google"}',
        off: true,
      });
    });

    it('draws the primary at the code step, saying when to try again once limited', () => {
      const codeStep = { ...step, confirmed: true, codeAsked: true };

      expect(everywhereButton(codeStep, t)).toEqual({
        kind: 'primary',
        label: 'devices.everywhereConfirm {"count":2}',
        off: false,
      });
      expect(everywhereButton({ ...codeStep, refusal: limited, until: '14:35' }, t)).toEqual({
        kind: 'primary',
        label: 'devices.everywhereRetryAt {"time":"14:35"}',
        off: true,
      });
    });

    it('draws the primary beside a password', () => {
      expect(
        everywhereButton({ ...step, providerName: null, working: true, keepsThisDevice: false }, t),
      ).toEqual({ kind: 'primary', label: 'devices.everywhereWorking', off: false });
    });
  });

  describe("when a limit on proving it's you lifts", () => {
    const until = new Date('2026-10-30T14:35:00Z');

    it('lifts after the time left, and at once when the time has passed', () => {
      expect(liftsIn({ kind: 'limited', until }, until.getTime() - 90_000)).toBe(90_000);
      expect(liftsIn({ kind: 'limited', until }, until.getTime() + 1_000)).toBe(0);
    });

    it('never lifts by itself when nothing says when, or nothing is limited', () => {
      expect(liftsIn({ kind: 'limited', until: null }, until.getTime())).toBeNull();
      expect(liftsIn({ kind: 'failed', message: 'x' }, until.getTime())).toBeNull();
      expect(liftsIn(null, until.getTime())).toBeNull();
    });
  });
});
