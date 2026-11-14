import { describe, expect, it } from 'vitest';

import { THEIR_LINK, asSent, inviteSmsOf } from './inviteSms.ts';
import { EVENT_NAME, HOSTS, MW, TICKS, checkOf, filled } from './messages.ts';
import { weddingAbout } from './messagesInvite.ts';
import { counterOf, failedWhy, smsReachLine, waitLine } from './messagesSms.ts';
import { noticeSmsOf } from './messagesNotice.ts';
import { COMING, GROUPS } from './messagesTo.ts';

const BOTH = { email: true, sms: true, whatsApp: true };
const LUCIA = {
  id: 'lucia',
  name: 'Lucía Ortega',
  greetAs: null,
  email: false,
  mobile: true,
  invited: 'Invited',
};
const notice = (first: boolean) =>
  asSent(filled(MW.noticeSms, { hosts: HOSTS, event: EVENT_NAME, link: THEIR_LINK }), first);

describe('SMS, the rules (sc-3946)', () => {
  it('says who SMS reaches and why the rest can’t be texted, each guest once, a 0 left out', () => {
    expect(smsReachLine('all')).toBe(
      'SMS reaches 39 of 142 · 102 have no mobile number and 1 stopped texts',
    );
    expect(smsReachLine('coming')).toBe('SMS reaches 31 of 96 · 65 have no mobile number');
    expect(smsReachLine('notReplied')).toBe('SMS reaches 9 of 25 · 16 have no mobile number');
  });

  it('keeps the reach count with WhatsApp ticked, while the check’s SMS pill leaves WhatsApp’s people out', () => {
    const smsOnly = checkOf(COMING, TICKS, GROUPS);
    const both = checkOf(COMING, BOTH, GROUPS);

    expect(both.sms).toBe(smsOnly.sms);
    expect(both.pills.find((one) => one.channel === 'sms')?.count).toBe(28);
  });

  it('counts the notice with the link as built: one part, two with the first text’s STOP line', () => {
    expect(counterOf(notice(false))).toBe('SMS · 1 part · GSM-7 · 154 characters');
    expect(counterOf(notice(true))).toBe('SMS · 2 parts · GSM-7 · 177 characters');
    expect(
      notice(true).text.endsWith(
        "Tunde's wedding. Read it here: [their own link]\nReply STOP to opt out.",
      ),
    ).toBe(true);
  });

  it('counts at each boundary: 160 and 161 in GSM-7, 70 and 71 in Unicode, 459 and 460', () => {
    expect(asSent('a'.repeat(160))).toMatchObject({ parts: 1, chars: 160, unicode: false });
    expect(asSent('a'.repeat(161)).parts).toBe(2);
    expect(asSent('ọ'.repeat(70))).toMatchObject({ parts: 1, chars: 70, unicode: true });
    expect(asSent('ọ'.repeat(71)).parts).toBe(2);
    expect(asSent('a'.repeat(459)).parts).toBe(3);
    expect(asSent('a'.repeat(460)).parts).toBe(4);
    expect(counterOf({ text: 'ọ', parts: 1, chars: 1, unicode: true })).toBe(
      'SMS · 1 part · Unicode · 1 character',
    );
  });

  it('sends typographic punctuation plain in every text, so the preview, the invitation and the credits count alike', () => {
    expect(asSent('Adaeze & Tunde’s “wedding” – soon… — ‘ok’').text).toBe(
      "Adaeze & Tunde's \"wedding\" - soon... - 'ok'",
    );

    const wedding = noticeSmsOf(HOSTS, 'Adaeze & Tunde – wedding');
    expect([wedding.unicode, wedding.parts]).toEqual([false, 1]);

    const bisi = inviteSmsOf(
      { ...LUCIA, name: 'Bisi Adeyemi', greetAs: '“Auntie Bisi”' },
      weddingAbout(),
      false,
    );
    expect(bisi.text).toContain('"Auntie Bisi"');
    expect(bisi.unicode).toBe(false);
  });

  it('sends a name’s letters as written, so Lucía Ortega’s invitation goes as Unicode', () => {
    const lucia = inviteSmsOf(LUCIA, weddingAbout(), false);

    expect(lucia.text).toContain('Lucía Ortega');
    expect(counterOf(lucia)).toMatch(/^SMS · 4 parts · Unicode · \d+ characters$/u);
  });

  it('says how many wait for 09:00 their time, on either channel, and nothing when nothing waits', () => {
    expect(waitLine(TICKS, 'quiet')).toBe('Texts to 4 people wait until 09:00, their time.');
    expect(waitLine(BOTH, 'quiet')).toBe(
      'Texts and WhatsApp messages to 4 people wait until 09:00, their time.',
    );
    expect(waitLine({ email: true, sms: false, whatsApp: true }, 'quiet')).toBe(
      'The WhatsApp message to 1 person waits until 09:00, their time.',
    );
    expect(waitLine({ email: true, sms: false, whatsApp: false }, 'quiet')).toBeNull();
    expect(waitLine(TICKS, 'live')).toBeNull();
    expect(waitLine(TICKS, undefined)).toBeNull();
  });

  it('words a failed text’s reason as a row phrase, with its code', () => {
    expect(failedWhy('30005')).toBe('Number not in use (30005)');
    expect(failedWhy('30006')).toBe('Number cannot receive texts (30006)');
    expect(failedWhy('30003')).toBe('Phone off or out of signal (30003)');
    expect(failedWhy('30007')).toBe('Blocked by their network (30007)');
    expect(failedWhy('other', '30008')).toBe('No reason given (30008)');
    expect(failedWhy('none')).toBe('No reason given');
  });
});
