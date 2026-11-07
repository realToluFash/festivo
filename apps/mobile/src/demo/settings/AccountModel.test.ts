import { describe, expect, it } from 'vitest';

import { SAMPLE } from '../samples.ts';
import {
  ACCOUNT_STATES,
  accountStart,
  accountStateOf,
  addCheck,
  addRefusal,
  cardLine,
  confirmSays,
  contactLine,
  contactsFoot,
  expiredLine,
  firstUnverified,
  matchLine,
  noZoneLine,
  primaryFirst,
  promoteLine,
  RESULTS,
  SECOND_EMAIL_ID,
  SECOND_PHONE_ID,
  shownOf,
  verifiedWords,
  verifyLead,
  WRONG_CODE,
  ZONE_TYPED,
  zoneLine,
  zoneMatches,
  zoneToSave,
} from './AccountModel.ts';
import { EMAILS, HOME_ZONE, PHONES, SECOND_EMAIL, SECOND_PHONE, ZONES } from './AccountSample.ts';

const verifiedAll = (rows: readonly { verified: boolean }[]) => rows.every((row) => row.verified);

describe('a state link', () => {
  it('opens the state it names, and the page at rest for anything else', () => {
    expect(ACCOUNT_STATES).toHaveLength(15);
    expect(accountStateOf('verifyPhoneExpired')).toBe('verifyPhoneExpired');
    expect(accountStateOf('done')).toBe('rest');
    expect(accountStateOf(undefined)).toBe('rest');
  });

  it('opens at rest with the second address unverified and nothing over the page', () => {
    expect(accountStart('rest')).toMatchObject({
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
    expect(accountStart('name').screen).toBe('name');
    expect(accountStart('addPhone').screen).toBe('addPhone');
    expect(accountStart('zone')).toMatchObject({ screen: 'zone', typedZone: ZONE_TYPED });
    expect(accountStart('addEmail').screen).toBe('addEmail');
    expect(accountStart('addEmail').emails.map((row) => row.shown)).toEqual([SAMPLE.email]);
  });

  it('opens the second address verified, with its Ask or Confirm it’s you over it', () => {
    for (const state of ['promote', 'remove', 'confirm'] as const) {
      const start = accountStart(state);
      expect(verifiedAll(start.emails)).toBe(true);
      expect(start.opened).toBe(SECOND_EMAIL_ID);
    }
    expect(accountStart('promote').ask).toBe('promote');
    expect(accountStart('remove').ask).toBe('remove');
    expect(accountStart('confirm')).toMatchObject({ ask: null, screen: 'confirm' });
  });

  it('opens verify on the second address at each stage', () => {
    expect(accountStart('verifyEmail').verifying).toEqual({
      kind: 'email',
      id: SECOND_EMAIL_ID,
      stage: 'entering',
    });
    expect(accountStart('verifyEmailWrong').verifying?.stage).toBe('wrong');
    expect(accountStart('verifyEmailExpired').verifying?.stage).toBe('expired');
    expect(accountStart('verifyEmail').screen).toBe('verify');
  });

  it('opens verify on a second, unverified number, the addresses already proved', () => {
    const start = accountStart('verifyPhone');
    expect(verifiedAll(start.emails)).toBe(true);
    expect(start.phones.map((row) => [row.shown, row.verified])).toEqual([
      [SAMPLE.phoneShown, true],
      [SECOND_PHONE, false],
    ]);
    expect(start.verifying).toEqual({ kind: 'phone', id: SECOND_PHONE_ID, stage: 'entering' });
    expect(accountStart('verifyPhoneExpired').verifying?.stage).toBe('expired');
  });

  it('opens the page after a right code, the card saying so', () => {
    const email = accountStart('verifyEmailDone');
    expect(email).toMatchObject({ screen: null, verifying: null });
    expect(email.said).toBe(verifiedWords(SECOND_EMAIL, 'email'));
    expect(verifiedAll(email.emails)).toBe(true);

    const phone = accountStart('verifyPhoneDone');
    expect(phone.said).toBe(verifiedWords(SECOND_PHONE, 'phone'));
    expect(verifiedAll(phone.phones)).toBe(true);
    expect(phone.phones).toHaveLength(2);
  });

  it('keeps the wrong code apart from the right one', () => {
    expect(WRONG_CODE).not.toBe(SAMPLE.code);
  });
});

describe('the card', () => {
  it('says what is not verified yet, the addresses before the numbers', () => {
    expect(cardLine(EMAILS, PHONES, null)).toEqual({
      kind: 'todo',
      text: `${SECOND_EMAIL} is not verified yet.`,
    });
    const start = accountStart('verifyPhone');
    expect(firstUnverified(start.emails, start.phones)).toMatchObject({
      kind: 'phone',
      row: { shown: SECOND_PHONE },
    });
  });

  it('says what just happened before anything left to do, and nothing once all is verified', () => {
    expect(cardLine(EMAILS, PHONES, 'Done.')).toEqual({ kind: 'done', text: 'Done.' });
    const proved = accountStart('promote').emails;
    expect(cardLine(proved, PHONES, null)).toBeNull();
    expect(firstUnverified(proved, PHONES)).toBeNull();
  });

  it('words each result as the spec has it', () => {
    expect(RESULTS.name('Folake Adeyemi-Bello')).toBe('Name changed to Folake Adeyemi-Bello.');
    expect(RESULTS.zone(HOME_ZONE)).toBe(
      'Time zone changed to Lagos (UTC+01:00). Times in your emails now use it.',
    );
    expect(RESULTS.primary('email', SECOND_EMAIL)).toBe(
      `${SECOND_EMAIL} is now your primary address. Sign in with it from now on.`,
    );
    expect(RESULTS.primary('phone', SECOND_PHONE)).toBe(
      `${SECOND_PHONE} is now your primary number.`,
    );
    expect(RESULTS.removed(SECOND_EMAIL)).toBe(`${SECOND_EMAIL} has been removed.`);
    expect(verifiedWords(SECOND_PHONE, 'phone')).toBe(
      `${SECOND_PHONE} is verified. It stays an alternative number until you make it primary.`,
    );
  });
});

describe('the rows', () => {
  it('puts the primary first, then the rest as added', () => {
    const swapped = EMAILS.map((row) => ({ ...row, primary: !row.primary }));
    expect(primaryFirst(swapped).map((row) => row.id)).toEqual(['email-2', 'email-1']);
    expect(shownOf(EMAILS, SECOND_EMAIL_ID)).toBe(SECOND_EMAIL);
  });

  it('says what each row does, and the zone by its IANA name', () => {
    expect(contactLine('email', EMAILS[0]!)).toBe('Primary · signs you in');
    expect(contactLine('email', EMAILS[1]!)).toBe('Can reach you, cannot sign you in');
    expect(contactLine('phone', PHONES[0]!)).toBe('Primary · on your profile');
    const zone = ZONES.find((row) => row.id === 'America/Los_Angeles')!;
    expect(zoneLine(zone)).toBe('Time zone · America/Los Angeles');
  });

  it('says how many more fit, or that two is the most', () => {
    expect(contactsFoot('email', EMAILS)).toBe(
      'You have 2, the most an account can hold. Remove one to add another.',
    );
    expect(contactsFoot('phone', PHONES)).toBe(
      'You can add one more. An account holds up to 2 phone numbers, including the primary.',
    );
  });

  it('names the address that stops signing you in', () => {
    expect(promoteLine(SAMPLE.email)).toContain(`${SAMPLE.email} stays linked`);
  });
});

describe('adding', () => {
  it('refuses a blank or malformed address, and a number of the wrong length', () => {
    expect(addCheck('email', '', 'GB')).toBe('Enter your email address.');
    expect(addCheck('email', 'folake.adeyemi@gmail', 'GB')).toMatch(/does not look like an email/u);
    expect(addCheck('email', 'folake@lumen.studio', 'GB')).toBeNull();
    expect(addCheck('phone', '', 'GB')).toBe('Enter your mobile number.');
    expect(addCheck('phone', '7400 12', 'GB')).toBe(
      'That number looks too short for United Kingdom. Check it and try again.',
    );
    expect(addCheck('phone', '7400 123457', 'GB')).toBeNull();
  });

  it('refuses one already linked, whatever its case', () => {
    expect(addRefusal('email', 'FOLAKE@ire.events', EMAILS)).toBe(
      'That address is already linked to an account.',
    );
    expect(addRefusal('phone', SAMPLE.phoneShown, PHONES)).toBe(
      'That number is already linked to an account.',
    );
    expect(addRefusal('email', 'folake@lumen.studio', EMAILS)).toBeNull();
  });
});

describe('the time zone', () => {
  it('shows at most eight matches, and the former name when it is what matched', () => {
    expect(zoneMatches(ZONE_TYPED).map((zone) => zone.city)).toEqual([
      'San Marino',
      'San Salvador',
      'Santarém',
      'Santiago',
      'Santo Domingo',
    ]);
    expect(zoneMatches('UTC+01').length).toBeLessThanOrEqual(8);
    expect(zoneMatches(' ')).toEqual([]);
    const kolkata = ZONES.find((zone) => zone.city === 'Kolkata')!;
    expect(matchLine(kolkata, 'Calc')).toBe('India · was Calcutta');
    expect(matchLine(HOME_ZONE, 'Lag')).toBe('Nigeria');
  });

  it('saves only a zone picked or named exactly, and says why not', () => {
    const marino = ZONES.find((zone) => zone.city === 'San Marino')!;
    expect(zoneToSave('San', marino)).toEqual({ zone: marino });
    expect(zoneToSave('San', null)).toEqual({ problem: 'Choose a time zone from the list.' });
    expect(zoneToSave('Atlantis', null)).toEqual({
      problem: 'Choose a time zone from the list. Nothing matches “Atlantis”.',
    });
    expect(noZoneLine(' Atlantis ')).toBe(
      'No time zone matches “Atlantis”. Try a city, a country or an offset like UTC+01.',
    );
  });
});

describe('proving it’s you and verifying', () => {
  it('says both blanks at once, then the password before the code', () => {
    expect(confirmSays('', '')).toEqual({
      password: 'Enter your password.',
      code: 'Enter a code from your app, or a recovery code.',
      checked: true,
    });
    expect(confirmSays('wrong', '000000')).toMatchObject({ code: null, checked: false });
    expect(confirmSays(SAMPLE.password, '714 320')).toEqual({
      password: null,
      code: 'That code did not work. Check your app and try again.',
      checked: false,
    });
    expect(confirmSays(SAMPLE.password, SAMPLE.recovery)).toEqual({
      password: null,
      code: null,
      checked: false,
    });
  });

  it('leads with where the code went, by channel', () => {
    expect(verifyLead('email', SECOND_EMAIL)).toBe(
      `We sent a code to ${SECOND_EMAIL}. Enter it here to show the address is yours.`,
    );
    expect(verifyLead('whatsApp', SECOND_PHONE)).toBe(
      `We sent a code to your WhatsApp on ${SECOND_PHONE}.`,
    );
    expect(verifyLead('text', SECOND_PHONE)).toMatch(/^We texted the same code/u);
    expect(expiredLine('whatsApp')).toMatch(/newest text\.$/u);
    expect(expiredLine('email')).toMatch(/newest email\.$/u);
  });
});
