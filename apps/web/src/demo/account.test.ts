import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_PAGES,
  ACCOUNT_STATES,
  FIRST_PHONE,
  WEB_MOMENTS,
  accountStart,
  cardLine,
  contactsFoot,
  madePrimary,
  opening,
  sampleCodeSource,
  sampleProof,
  verifiedWords,
} from './account.ts';
import { primaryFirst } from '@soirely/domain';
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

  it('proves with the sample’s password and its authenticator or a recovery code', async () => {
    await expect(sampleProof({ password: 'wrong' }, SAMPLE.authenticator)).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
    await expect(sampleProof({ password: SAMPLE.password }, '714 320')).rejects.toMatchObject({
      code: 'two_factor_code_invalid',
    });
    await expect(
      sampleProof({ password: SAMPLE.password }, SAMPLE.recovery.toUpperCase()),
    ).resolves.toBe('sample-proof');
  });

  it('sends the code where the opening says, and verifies only the sample’s', async () => {
    const texted = sampleCodeSource(opening('verify', { channel: 'text' }));
    await expect(texted.opening()).resolves.toMatchObject({
      route: 'sms_chosen',
      codeState: 'live',
    });
    await expect(
      sampleCodeSource(opening('verify', { expired: true })).opening(),
    ).resolves.toMatchObject({ route: null, codeState: 'expired', cooldownSeconds: 0 });
    await expect(texted.verify('482170')).rejects.toMatchObject({
      code: 'verification_code_invalid',
    });
    await expect(texted.verify(SAMPLE.code)).resolves.toEqual({ primary: false });

    const whatsApp = sampleCodeSource(opening('verify', { channel: 'whatsApp' }));
    await whatsApp.textInstead();
    await expect(whatsApp.opening()).resolves.toMatchObject({ route: 'sms_chosen' });
  });
});
