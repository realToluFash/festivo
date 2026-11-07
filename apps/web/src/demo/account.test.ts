import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_PAGES,
  ACCOUNT_STATES,
  FIRST_PHONE,
  WEB_MOMENTS,
  accountStart,
  cardLine,
  codeRefusal,
  contactsFoot,
  emailRefusal,
  madePrimary,
  phoneRefusal,
  primaryFirst,
  proveProblems,
  verifiedWords,
  zoneChosen,
  zoneMatches,
  zoneRefusal,
} from './account.ts';
import { SAMPLE } from './rules.ts';
import { VIEWERS } from './settings.ts';

const rest = accountStart('');

describe('Your account’s sample (sc-30209)', () => {
  it('opens an unknown state on the page at rest, the second address not verified yet', () => {
    expect(accountStart('rest')).toEqual(rest);
    expect(accountStart('nowhere')).toEqual(rest);
    expect(rest.emails.map((row) => [row.shown, row.verified, row.primary])).toEqual([
      [SAMPLE.email, true, true],
      [SAMPLE.otherEmail, false, false],
    ]);
    expect(rest.phones.map((row) => row.shown)).toEqual([FIRST_PHONE]);
    expect(FIRST_PHONE).toBe('+44 7400 123456');
  });

  it('is the viewer’s own account, the same for every role', () => {
    const admin = accountStart('', VIEWERS.julien);

    expect(admin.name).toBe('Julien Moreau');
    expect(admin.emails[0]?.shown).toBe('julien@ire.events');
    expect(admin.emails[1]?.shown).toBe('julien.moreau@outlook.com');
    expect(accountStart('promote', VIEWERS.ana).ask).toBe('promote');
  });

  it('opens each of the app’s states on what it shows', () => {
    expect(accountStart('name').dialog).toMatchObject({ kind: 'name', typed: SAMPLE.name });
    expect(accountStart('promote')).toMatchObject({ open: 'email-2', ask: 'promote' });
    expect(accountStart('confirm').dialog).toMatchObject({ kind: 'confirm', contact: 'email-2' });
    expect(accountStart('remove')).toMatchObject({ open: 'email-2', ask: 'remove' });
    expect(accountStart('addEmail').emails).toHaveLength(1);
    expect(accountStart('zone').dialog).toMatchObject({ kind: 'zone', typed: 'San' });
    expect(accountStart('verifyEmailWrong').dialog).toMatchObject({
      kind: 'verify',
      channel: 'email',
      typed: '482170',
      tried: true,
    });
    expect(accountStart('verifyPhoneExpired').dialog).toMatchObject({
      channel: 'whatsApp',
      contact: 'phone-2',
      expired: true,
    });
    expect(accountStart('verifyPhoneDone').phones.every((row) => row.verified)).toBe(true);
  });

  it('links every state and moment from the demo’s home', () => {
    const linked = ACCOUNT_PAGES.flatMap((page) => page.states.map((state) => state.to));

    for (const state of [...ACCOUNT_STATES, ...WEB_MOMENTS])
      expect(linked).toContain(`/demo/settings/account?state=${state}`);
    expect(linked).toContain('/demo/settings/account');
  });

  it('says on the card what is unfinished, or what was just done, and steps only while unverified', () => {
    expect(cardLine(rest.emails, rest.phones, null)).toMatchObject({
      line: `${SAMPLE.otherEmail} is not verified yet.`,
      done: false,
    });
    const proved = accountStart('allVerified');
    expect(cardLine(proved.emails, proved.phones, null)).toEqual({
      line: null,
      done: false,
      waiting: null,
    });
    expect(cardLine(rest.emails, rest.phones, 'Saved.').done).toBe(true);
    expect(cardLine(rest.emails, rest.phones, 'Saved.').waiting?.id).toBe('email-2');
  });

  it('puts the primary first, and moves it on a new primary', () => {
    const moved = madePrimary(rest.emails, 'email-2');

    expect(primaryFirst(moved).map((row) => row.id)).toEqual(['email-2', 'email-1']);
    expect(verifiedWords(rest.phones[0]!)).toBe(
      '+44 7400 123456 is verified. It stays an alternative number until you make it primary.',
    );
  });

  it('counts what fits in the foot', () => {
    expect(contactsFoot('email', rest.emails)).toBe(
      'You have 2, the most an account can hold. Remove one to add another.',
    );
    expect(contactsFoot('phone', rest.phones)).toBe(
      'You can add one more. An account holds up to 2 phone numbers, including the primary.',
    );
  });

  it('refuses an address or a number as the build does', () => {
    const one = accountStart('addEmail').emails;

    expect(emailRefusal('', one)).toBe('Enter your email address.');
    expect(emailRefusal('folake.adeyemi@gmail', one)).toBe(
      'That does not look like an email address. Check it has an @ and a domain.',
    );
    expect(emailRefusal(' Folake@ire.events ', one)).toBe(
      'That address is already linked to an account.',
    );
    expect(emailRefusal('folake@lumen.studio', one)).toBeNull();
    expect(phoneRefusal('7400 12', 'GB', rest.phones)).toBe(
      'That number looks too short for United Kingdom. Check it and try again.',
    );
    expect(phoneRefusal('7400 123456', 'GB', rest.phones)).toBe(
      'That number is already linked to an account.',
    );
    expect(phoneRefusal('7700 900461', 'GB', rest.phones)).toBeNull();
  });

  it('finds time zones and asks for one from the list', () => {
    expect(zoneMatches('San').map((match) => match.label)).toEqual([
      'San Marino (UTC+01:00)',
      'San Salvador (UTC-06:00)',
      'Santarém (UTC-03:00)',
      'Santiago (UTC-03:00)',
      'Santo Domingo (UTC-04:00)',
    ]);
    expect(zoneMatches('Calcutta')[0]?.line).toBe('India · was Calcutta');
    expect(zoneChosen('San', null)).toBeNull();
    expect(zoneChosen('lagos', null)?.id).toBe('Africa/Lagos');
    expect(zoneRefusal('San')).toBe('Choose a time zone from the list.');
    expect(zoneRefusal('Atlantis')).toBe(
      'Choose a time zone from the list. Nothing matches “Atlantis”.',
    );
  });

  it('checks codes and the proof', () => {
    expect(codeRefusal('', 'whatsApp')).toBe('Enter the 6-digit code from WhatsApp.');
    expect(codeRefusal('4829', 'email')).toBe('The code is 6 digits.');
    expect(codeRefusal('482170', 'text')).toBe(
      'That code does not match. Check the newest text from Soirely and try again.',
    );
    expect(codeRefusal('482 913', 'email')).toBeNull();
    expect(proveProblems('', '')).toEqual({
      password: 'Enter your password.',
      code: 'Enter a code from your app, or a recovery code.',
    });
    expect(proveProblems(SAMPLE.password, '714 320')).toEqual({
      code: 'That code did not work. Check your app and try again.',
    });
    expect(proveProblems(SAMPLE.password, SAMPLE.recovery.toUpperCase())).toEqual({});
  });
});
