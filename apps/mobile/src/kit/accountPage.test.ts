import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';

import {
  type Contact,
  cardLine,
  contactLine,
  contactsFoot,
  promotedWords,
  verifiedWords,
  verifyWords,
  zoneLine,
} from './accountPage.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const FIRST = 'folake@ire.events';
const SECOND = 'folake.adeyemi@gmail.com';
const NUMBER = '+44 7700 900461';
const EMAILS: Contact[] = [
  { id: 'email-1', shown: FIRST, verified: true, primary: true },
  { id: 'email-2', shown: SECOND, verified: false, primary: false },
];
const PHONES: Contact[] = [{ id: 'phone-1', shown: NUMBER, verified: false, primary: true }];
const proved = (rows: Contact[]) => rows.map((row) => ({ ...row, verified: true }));

describe('the card under you', () => {
  it('says what is not verified yet, the addresses before the numbers', () => {
    expect(cardLine(EMAILS, PHONES, null, t)).toEqual({
      kind: 'todo',
      text: `${SECOND} is not verified yet.`,
    });
  });

  it('says what just happened before anything left to do, and nothing once all is verified', () => {
    expect(cardLine(EMAILS, PHONES, 'Done.', t)).toEqual({ kind: 'done', text: 'Done.' });
    expect(cardLine(proved(EMAILS), proved(PHONES), null, t)).toBeNull();
  });

  it('words a verified primary apart from an alternative, and a promotion', () => {
    expect(verifiedWords(EMAILS[0]!, 'email', t)).toBe(`${FIRST} is verified.`);
    expect(verifiedWords(EMAILS[1]!, 'email', t)).toBe(
      `${SECOND} is verified. It stays an alternative address until you make it primary.`,
    );
    expect(verifiedWords(PHONES[0]!, 'phone', t)).toBe(
      `${NUMBER} is verified and is now your primary number.`,
    );
    expect(promotedWords('email', SECOND, t)).toBe(
      `${SECOND} is now your primary address. Sign in with it from now on.`,
    );
  });
});

describe('the rows', () => {
  it('says what each row does, and the zone by its IANA name', () => {
    expect(contactLine('email', EMAILS[0]!, t)).toBe('Primary · signs you in');
    expect(contactLine('email', EMAILS[1]!, t)).toBe('Can reach you, cannot sign you in');
    expect(contactLine('phone', PHONES[0]!, t)).toBe('Primary · on your profile');
    expect(zoneLine('America/Los_Angeles', t)).toBe('Time zone · America/Los Angeles');
  });

  it('says how many more fit, or that two is the most', () => {
    expect(contactsFoot('email', EMAILS, t)).toBe(
      'You have 2, the most an account can hold. Remove one to add another.',
    );
    expect(contactsFoot('phone', PHONES, t)).toBe(
      'You can add one more. An account holds up to 2 phone numbers, including the primary.',
    );
  });
});

describe('Check your email and Check your messages', () => {
  it('leads with where the code went', () => {
    expect(verifyWords('email', SECOND, t).lead).toContain(SECOND);
    expect(verifyWords('whatsapp', NUMBER, t).lead).toContain('WhatsApp');
    expect(verifyWords('chosen', NUMBER, t).lead).not.toBe(verifyWords('texted', NUMBER, t).lead);
  });
});
