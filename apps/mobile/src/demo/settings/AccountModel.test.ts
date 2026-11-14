import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import { verifiedWords } from '../../kit/accountPage.ts';
import { SAMPLE } from '../samples.ts';
import {
  ACCOUNT_STATES,
  accountProof,
  accountStart,
  accountStateOf,
  addRefusal,
  confirmSays,
  PRIMARY_EMAIL_ID,
  SECOND_EMAIL_ID,
  SECOND_PHONE_ID,
  WRONG_CODE,
  ZONE_TYPED,
} from './AccountModel.ts';
import { EMAILS, PHONES, SECOND_EMAIL, SECOND_PHONE } from './AccountSample.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const verifiedAll = (rows: readonly { verified: boolean }[]) => rows.every((row) => row.verified);
const start = (state: (typeof ACCOUNT_STATES)[number]) => accountStart(state, t);

describe('a state link', () => {
  it('opens the state it names, and the page at rest for anything else', () => {
    expect(ACCOUNT_STATES).toHaveLength(20);
    expect(accountStateOf('verifyPhoneExpired')).toBe('verifyPhoneExpired');
    expect(accountStateOf('done')).toBe('rest');
    expect(accountStateOf(undefined)).toBe('rest');
  });

  it('opens at rest with the second address unverified and nothing over the page', () => {
    expect(start('rest')).toMatchObject({
      emails: EMAILS,
      phones: PHONES,
      said: null,
      opened: null,
      ask: null,
      screen: null,
      verifying: null,
    });
  });

  it('opens each focused screen its frame draws', () => {
    expect(start('name').screen).toBe('name');
    expect(start('addPhone')).toMatchObject({ screen: 'addPhone', phoneCountry: 'GB' });
    expect(start('addPhoneNoCountry')).toMatchObject({ screen: 'addPhone', phoneCountry: '' });
    expect(start('zone')).toMatchObject({ screen: 'zone', typedZone: ZONE_TYPED });
    expect(start('zoneWaiting')).toMatchObject({ screen: null, zoneHeld: true });
    expect(start('zone').zoneHeld).toBe(false);
    expect(start('addEmail').screen).toBe('addEmail');
    expect(start('addEmail').emails.map((row) => row.shown)).toEqual([SAMPLE.email]);
  });

  it('opens the second address verified, with its Ask or Confirm it’s you over it', () => {
    for (const state of ['promote', 'remove', 'confirm'] as const) {
      expect(verifiedAll(start(state).emails)).toBe(true);
      expect(start(state).opened).toBe(SECOND_EMAIL_ID);
    }
    expect(start('promote').ask).toBe('promote');
    expect(start('remove').ask).toBe('remove');
    expect(start('confirm')).toMatchObject({ ask: null, screen: 'confirm' });
  });

  it('opens verify on the second address at each stage', () => {
    expect(start('verifyEmail').verifying).toEqual({
      kind: 'email',
      id: SECOND_EMAIL_ID,
      stage: 'entering',
    });
    expect(start('verifyEmailWrong').verifying?.stage).toBe('wrong');
    expect(start('verifyEmailExpired').verifying?.stage).toBe('expired');
    expect(start('verifyEmail').screen).toBe('verify');
  });

  it('opens verify on a second, unverified number, the addresses already proved', () => {
    const phone = start('verifyPhone');
    expect(verifiedAll(phone.emails)).toBe(true);
    expect(phone.phones.map((row) => [row.shown, row.verified])).toEqual([
      [SAMPLE.phoneShown, true],
      [SECOND_PHONE, false],
    ]);
    expect(phone.verifying).toEqual({ kind: 'phone', id: SECOND_PHONE_ID, stage: 'entering' });
    expect(start('verifyPhoneExpired').verifying?.stage).toBe('expired');
  });

  it('opens the page after a right code, the card saying so', () => {
    const email = start('verifyEmailDone');
    expect(email).toMatchObject({ screen: null, verifying: null });
    expect(email.said).toBe(
      verifiedWords(
        { id: SECOND_EMAIL_ID, shown: SECOND_EMAIL, verified: true, primary: false },
        'email',
        t,
      ),
    );
    expect(verifiedAll(email.emails)).toBe(true);

    const phone = start('verifyPhoneDone');
    expect(phone.said).toContain(SECOND_PHONE);
    expect(verifiedAll(phone.phones)).toBe(true);
    expect(phone.phones).toHaveLength(2);
  });

  it('keeps the wrong code apart from the right one', () => {
    expect(WRONG_CODE).not.toBe(SAMPLE.code);
  });
});

describe('adding', () => {
  it('sends the focus to the Code for "Choose a country.", and to the number for its own lines', () => {
    const add = readFileSync(join('src', 'components', 'AccountAdd.tsx'), 'utf8');

    expect(add).toMatch(
      /if \(on === 'country'\) focusPicker\(picker\);\s+else focusChecked\(field\);/u,
    );
    expect(add).toMatch(/pickerRef=\{picker\}/u);
  });

  it('refuses one already linked, whatever its case', () => {
    expect(addRefusal('email', 'FOLAKE@ire.events', EMAILS, t)).toBe(t('contacts.alreadyLinked'));
    expect(addRefusal('phone', SAMPLE.phoneShown, PHONES, t)).toBe(
      t('contacts.alreadyLinkedPhone'),
    );
    expect(addRefusal('email', 'folake@lumen.studio', EMAILS, t)).toBeNull();
  });
});

describe('proving it’s you', () => {
  it('says both blanks at once, then the password before the code', () => {
    const asks = accountProof(t);

    expect(confirmSays('', '', asks)).toEqual({
      password: 'Enter your password.',
      code: 'Enter a code from your app, or a recovery code.',
      checked: true,
    });
    expect(confirmSays('wrong', '000000', asks)).toMatchObject({ code: null, checked: false });
    expect(confirmSays(SAMPLE.password, '714 320', asks)).toEqual({
      password: null,
      code: 'That code did not work. Check your app and try again.',
      checked: false,
    });
    expect(confirmSays(SAMPLE.password, SAMPLE.recovery, asks)).toEqual({
      password: null,
      code: null,
      checked: false,
    });
  });
});

describe('an address we could not deliver to', () => {
  it('is nobody’s at rest', () => {
    expect(start('rest').undeliverable).toEqual([]);
  });

  it('is the only address, with room to add another', () => {
    expect(start('undeliverable')).toMatchObject({
      emails: [EMAILS[0]],
      undeliverable: [PRIMARY_EMAIL_ID],
    });
  });

  it('is both addresses, verified, with the account full', () => {
    const two = start('undeliverableTwo');
    expect(verifiedAll(two.emails)).toBe(true);
    expect(two.undeliverable).toEqual([PRIMARY_EMAIL_ID, SECOND_EMAIL_ID]);
  });

  it('is the second address while it is still not verified', () => {
    expect(start('undeliverableUnverified')).toMatchObject({
      emails: EMAILS,
      undeliverable: [SECOND_EMAIL_ID],
    });
  });
});
