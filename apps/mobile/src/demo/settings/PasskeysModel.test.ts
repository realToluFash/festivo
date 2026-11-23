import { describe, expect, it } from 'vitest';

import {
  APP_ON,
  codeInstead,
  factorRows,
  type Factors,
  offersAddApp,
  offersAddPasskey,
  PASSKEY_CAP,
  passkeyChoice,
  samplePasskeys,
  secondStep,
  unlockOf,
  withoutFactor,
} from './PasskeysModel.ts';

const appOnly: Factors = { app: APP_ON, passkeys: [] };
const passkeysOnly: Factors = { app: null, passkeys: samplePasskeys(2) };
const both: Factors = { app: APP_ON, passkeys: samplePasskeys(2) };

describe('the passkey choice', () => {
  it('names Face ID or Touch ID where one is enrolled on an iPhone or iPad', () => {
    expect(passkeyChoice(unlockOf(true, 'faceId')).title).toBe('Use Face ID');
    expect(passkeyChoice(unlockOf(true, 'touchId')).title).toBe('Use Touch ID');
  });

  it('says Use a passkey on Android, and on an iPhone with neither enrolled', () => {
    expect(passkeyChoice(unlockOf(false, 'faceId')).title).toBe('Use a passkey');
    expect(passkeyChoice(unlockOf(true, null)).title).toBe('Use a passkey');
  });
});

describe('the Two-factor card', () => {
  it('lists the factors newest first, each passkey with its provider, backup state and day', () => {
    const rows = factorRows(both, 'en-US');

    expect(rows.map((row) => row.title)).toEqual([
      'iCloud Keychain',
      'Google Password Manager',
      'Authenticator app',
    ]);
    expect(rows[0]?.line).toBe('Synced · Added Nov 20');
    expect(rows[2]?.line).toBe('Turned on Oct 12');
  });

  it('shows Passkey and This device only for a passkey with no known provider', () => {
    const row = factorRows({ app: null, passkeys: samplePasskeys(3) }, 'en-US')[2];

    expect(row?.title).toBe('Passkey');
    expect(row?.line).toBe('This device only · Added Nov 14');
  });

  it('offers Remove… on every factor but the last', () => {
    expect(factorRows(both, 'en-US').every((row) => row.removable)).toBe(true);
    expect(factorRows(appOnly, 'en-US')[0]?.removable).toBe(false);
    expect(factorRows(withoutFactor(passkeysOnly, 'passkey-1'), 'en-US')[0]?.removable).toBe(false);
  });

  it('offers Add a passkey under 10, and Add an authenticator app with passkeys only', () => {
    expect(offersAddPasskey({ app: null, passkeys: samplePasskeys(PASSKEY_CAP - 1) })).toBe(true);
    expect(offersAddPasskey({ app: null, passkeys: samplePasskeys(PASSKEY_CAP) })).toBe(false);
    expect(offersAddApp(passkeysOnly)).toBe(true);
    expect(offersAddApp(both)).toBe(false);
    expect(offersAddApp(appOnly)).toBe(false);
  });
});

describe('after the first factor', () => {
  it('takes a passkey from a member with one, and a code from a member with only the app', () => {
    expect(secondStep(both)).toBe('passkey');
    expect(secondStep(appOnly)).toBe('code');
  });

  it('sends Use a code instead to Enter a recovery code with passkeys only', () => {
    expect(codeInstead(both)).toBe('code');
    expect(codeInstead(passkeysOnly)).toBe('recovery');
  });
});
