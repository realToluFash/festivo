import { describe, expect, it } from 'vitest';

import {
  APP_ON,
  MAX_PASSKEYS,
  PASSKEYS,
  PASSKEY_WORDS,
  TEN_PASSKEYS,
  atMost,
  codeStepOf,
  factorRows,
  firstStep,
  heldOf,
  LOST_WORDS,
  offersApp,
  offersPasskey,
  passkeyName,
  turnOffAt,
} from './passkeys.ts';

const appOnly = { app: APP_ON, passkeys: [] };
const passkeysOnly = { app: null, passkeys: PASSKEYS };
const both = { app: APP_ON, passkeys: PASSKEYS };
const ten = { app: null, passkeys: TEN_PASSKEYS };

describe('two-factor with a passkey (sc-86885)', () => {
  it('lists the factors newest first, the app among them by its date', () => {
    expect(factorRows(both).map((row) => row.key)).toEqual([
      'pk-icloud',
      'pk-google',
      'pk-key',
      'auth',
    ]);
    expect(TEN_PASSKEYS).toHaveLength(MAX_PASSKEYS);
  });

  it('offers Add a passkey under ten in a browser that can, and the line at ten', () => {
    expect(offersPasskey(appOnly, true)).toBe(true);
    expect(offersPasskey(ten, true)).toBe(false);
    expect(atMost(ten, true)).toBe(true);
    expect(offersPasskey(appOnly, false)).toBe(false);
    expect(atMost(ten, false)).toBe(false);
    expect(PASSKEY_WORDS.atMost).toBe(
      'You have 10 passkeys, the most an account can hold. Remove one to add another.',
    );
  });

  it('offers the app only beside passkeys, and Turn off in the last factor’s row', () => {
    expect(offersApp(passkeysOnly)).toBe(true);
    expect(offersApp(both)).toBe(false);
    expect(offersApp(appOnly)).toBe(false);
    expect(turnOffAt(appOnly)).toBe('row');
    expect(turnOffAt({ app: null, passkeys: [PASSKEYS[0]] })).toBe('row');
    expect(turnOffAt(both)).toBe('end');
  });

  it('opens on the sheet where it can, and Use a code instead on the app or a recovery code', () => {
    expect(firstStep(both, true)).toBe('passkey');
    expect(firstStep(both, false)).toBe('code');
    expect(firstStep(passkeysOnly, false)).toBe('recovery');
    expect(firstStep(appOnly, true)).toBe('code');
    expect(codeStepOf(passkeysOnly)).toBe('recovery');
  });

  it('names a passkey by its listed provider, else Passkey', () => {
    expect(passkeyName(PASSKEYS[0])).toBe('iCloud Keychain');
    expect(passkeyName(PASSKEYS[2])).toBe('Passkey');
  });
});

describe('the lost-two-factor link', () => {
  it('names the factors the member has', () => {
    expect(LOST_WORDS[heldOf(appOnly)]).toBe('Lost your authenticator and your recovery codes?');
    expect(LOST_WORDS[heldOf(passkeysOnly)]).toBe('Lost your passkeys and your recovery codes?');
    expect(LOST_WORDS[heldOf({ app: APP_ON, passkeys: PASSKEYS })]).toBe(
      'Lost your passkeys, your authenticator and your recovery codes?',
    );
  });
});
