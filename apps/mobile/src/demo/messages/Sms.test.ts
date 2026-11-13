import { describe, expect, it } from 'vitest';

import { MESSAGES_BOARDS } from './MessagesBoards.ts';
import { type Draft, checkOf, reduce, startOf } from './MessagesModel.ts';
import { HAPPENING_NOW, MOBILES, PREVIEW, QUIET_NOW } from './MessagesSample.ts';
import type { ChannelKey } from './MessagesWords.ts';
import { PREVIEW_AS, previewOf, smsNoticeFor } from './PreviewModel.ts';
import { PREVIEW_PEOPLE } from './PreviewSample.ts';
import {
  SMS_STATES,
  clockNote,
  failedReason,
  isQuiet,
  isSmsState,
  plainPunctuation,
  quietLineOf,
  quietWaitOf,
  smsCountOf,
  smsHead,
  wallTime,
  zoneOf,
} from './Sms.ts';
import { saySms } from './SmsWords.ts';

const ticks = (...on: readonly ChannelKey[]): Record<ChannelKey, boolean> => ({
  email: on.includes('email'),
  sms: on.includes('sms'),
  wa: on.includes('wa'),
});
const head = (text: string) => smsHead(smsCountOf(text, PREVIEW.link));
const quietOf = (draft: Draft | null, clock: string | undefined) =>
  draft == null ? null : quietLineOf(MOBILES[draft.to], draft.channels, clock);

describe('sc-3946’s states', () => {
  it('each opens from ?state= and has its board on the demo home', () => {
    for (const state of SMS_STATES) {
      expect(isSmsState(state)).toBe(true);
      expect(MESSAGES_BOARDS.find((board) => board.state === state)?.href).toBe(
        `/demo/events/evt-wed-4?area=messages&state=${state}`,
      );
    }
    expect(isSmsState('checkWhatsApp')).toBe(false);
  });

  it('seed what the boards draw', () => {
    expect(startOf('smsLine', false).draft).toMatchObject({
      step: 'write',
      to: 'all',
      channels: ticks('email', 'sms'),
    });
    expect(startOf('checkQuiet', false)).toMatchObject({
      clock: QUIET_NOW,
      draft: { step: 'check', to: 'coming', channels: ticks('email', 'sms') },
    });
    expect(startOf('checkQuietBoth', false)).toMatchObject({
      clock: QUIET_NOW,
      draft: { to: 'coming', channels: ticks('email', 'sms', 'wa') },
    });
    expect(startOf('checkNow', true)).toMatchObject({
      clock: HAPPENING_NOW,
      draft: { to: 'coming', channels: ticks('email', 'sms') },
    });
    expect(startOf('reachedSmsFailed', false)).toMatchObject({
      smsFailed: true,
      open: { kind: 'reached', of: 'draft' },
    });
    expect(previewOf(startOf('previewFirstText', false)).who).toBe('amaka');
    expect(previewOf(startOf('preview', false)).who).toBe('kwame');
    expect(startOf('check', false).clock).toBeUndefined();
  });

  it('shows the time in the demo’s own box only while the wedding is happening', () => {
    expect(clockNote(HAPPENING_NOW)).toBe(
      'Thu, Nov 5 at 23:00 London time. The wedding is Happening now, so no text waits for morning.',
    );
    expect(clockNote(QUIET_NOW)).toBeNull();
    expect(clockNote(undefined)).toBeNull();
  });
});

describe('quiet hours', () => {
  it('reads each number’s own time from its calling code', () => {
    expect(zoneOf('+57 310 555 0187')).toBe('America/Bogota');
    expect(zoneOf('+55 21 99555 0142')).toBe('America/Sao_Paulo');
    expect(zoneOf('+44 7700 900412')).toBe('Europe/London');
    expect(zoneOf('+1 212 555 0100')).toBe('Europe/London');
    expect(wallTime(QUIET_NOW, 'America/Bogota')).toBe('04:41');
    expect(wallTime(QUIET_NOW, 'America/Sao_Paulo')).toBe('06:41');
  });

  it('runs from 20:00 to 09:00 their time', () => {
    const london = 'Europe/London';
    expect(isQuiet('2026-11-03T08:59:00Z', london)).toBe(true);
    expect(isQuiet('2026-11-03T09:00:00Z', london)).toBe(false);
    expect(isQuiet('2026-11-03T19:59:00Z', london)).toBe(false);
    expect(isQuiet('2026-11-03T20:00:00Z', london)).toBe(true);
  });

  it('says who waits for Coming at 09:41, by what is ticked', () => {
    const coming = MOBILES.coming;
    expect(quietLineOf(coming, ticks('email', 'sms'), QUIET_NOW)).toBe(
      'Texts to 4 people wait until 09:00, their time.',
    );
    expect(quietLineOf(coming, ticks('email', 'sms', 'wa'), QUIET_NOW)).toBe(
      'Texts and WhatsApp messages to 4 people wait until 09:00, their time.',
    );
    expect(quietLineOf(coming, ticks('wa'), QUIET_NOW)).toBe(
      'The WhatsApp message to 1 person waits until 09:00, their time.',
    );
    expect(quietLineOf(coming, ticks('email'), QUIET_NOW)).toBeNull();
  });

  it('has no line when nothing waits, nor without a clock', () => {
    expect(quietLineOf(MOBILES.coming, ticks('email', 'sms'), undefined)).toBeNull();
    expect(quietLineOf(MOBILES.coming, ticks('sms'), '2026-11-03T15:00:00Z')).toBeNull();
  });

  it('waits for nothing while the event is happening', () => {
    expect(quietWaitOf(MOBILES.coming, ticks('sms', 'wa'), HAPPENING_NOW)).toBeNull();
    expect(
      quietWaitOf(MOBILES.coming, ticks('sms'), HAPPENING_NOW, {
        starts: '2026-11-08T18:00:00Z',
        ends: '2026-11-09T18:00:00Z',
      }),
    ).toEqual({ by: 'sms', count: 5 });
  });

  it('says one person in each form', () => {
    expect(saySms.waits('sms', 1, '09:00')).toBe(
      'The text to 1 person waits until 09:00, their time.',
    );
    expect(saySms.waits('both', 1, '09:00')).toBe(
      'Messages to 1 person by text or WhatsApp wait until 09:00, their time.',
    );
    expect(saySms.waits('wa', 2, '09:00')).toBe(
      'WhatsApp messages to 2 people wait until 09:00, their time.',
    );
  });

  it('recomputes in a quiet state as the chips change', () => {
    const quiet = startOf('checkQuiet', false);
    expect(quietOf(quiet.draft, quiet.clock)).toBe(
      'Texts to 4 people wait until 09:00, their time.',
    );
    const both = reduce(quiet, { type: 'channel', key: 'wa' });
    expect(quietOf(both.draft, both.clock)).toBe(
      'Texts and WhatsApp messages to 4 people wait until 09:00, their time.',
    );
    const now = startOf('checkNow', false);
    expect(quietOf(now.draft, now.clock)).toBeNull();
  });
});

describe('the quiet check with both ticked', () => {
  it('keeps WhatsApp’s people out of the SMS pill, and its reach lines in order', () => {
    const check = checkOf(startOf('checkQuietBoth', false).draft as Draft);

    expect(check.told).toEqual([
      { key: 'email', count: 92 },
      { key: 'sms', count: 28 },
      { key: 'wa', count: 3 },
    ]);
    expect(check.smsReach).toBe('SMS reaches 31 of 96 · 65 have no mobile number');
    expect(check.reach).toMatch(/^WhatsApp reaches 3 of 96/u);
    expect(check.instead).toBe('3 by WhatsApp instead of SMS');
  });
});

describe('the SMS card’s counter', () => {
  it('counts GSM-7 at 160, then 153 a part', () => {
    expect(head('x'.repeat(160))).toBe('SMS · 1 part · GSM-7 · 160 characters');
    expect(head('x'.repeat(161))).toBe('SMS · 2 parts · GSM-7 · 161 characters');
    expect(head('x'.repeat(459))).toBe('SMS · 3 parts · GSM-7 · 459 characters');
    expect(head('x'.repeat(460))).toBe('SMS · 4 parts · GSM-7 · 460 characters');
  });

  it('counts Unicode at 70, then 67 a part', () => {
    expect(head('ł'.repeat(70))).toBe('SMS · 1 part · Unicode · 70 characters');
    expect(head('ł'.repeat(71))).toBe('SMS · 2 parts · Unicode · 71 characters');
    expect(head('x')).toBe('SMS · 1 part · GSM-7 · 1 character');
  });

  it('counts the shown link at the built link’s 65 characters', () => {
    expect(smsCountOf(`Read it here: ${PREVIEW.link}`, PREVIEW.link).chars).toBe(14 + 65);
  });

  it('sends filled-in values with plain punctuation', () => {
    expect(plainPunctuation('Adaeze & Tunde’s “wedding” – soon…')).toBe(
      'Adaeze & Tunde\'s "wedding" - soon...',
    );
  });
});

describe('the preview’s SMS', () => {
  it('to Kwame Mensah, texted before: one part, no STOP line', () => {
    const notice = smsNoticeFor(PREVIEW_PEOPLE.kwame);

    expect(notice.text).toBe(
      "Adaeze Obi and Tunde Bakare: a new message about Adaeze & Tunde's wedding. Read it here: [their own link]",
    );
    expect(smsHead(notice.count)).toBe('SMS · 1 part · GSM-7 · 154 characters');
    expect(notice.first).toBe(false);
  });

  it('to Amaka Eze, a first text: the STOP line on its own, two parts', () => {
    const notice = smsNoticeFor(PREVIEW_PEOPLE.amaka);

    expect(notice.text.endsWith('[their own link]\nReply STOP to opt out.')).toBe(true);
    expect(smsHead(notice.count)).toBe('SMS · 2 parts · GSM-7 · 177 characters');
    expect(notice.first).toBe(true);
    expect(saySms.firstText('Ire Events')).toBe(
      'Their first text from Ire Events, so it ends with how to stop texts.',
    );
  });

  it('offers Amaka Eze first, with no email address, and only she gets a first text', () => {
    expect(PREVIEW_AS[0]?.key).toBe('amaka');
    expect(PREVIEW_PEOPLE.amaka).toMatchObject({ email: false, greetAs: null, language: 'en' });
    expect(PREVIEW_AS.filter((person) => person.firstText).map((person) => person.key)).toEqual([
      'amaka',
    ]);
  });

  it('in French keeps the bracketed stand-in, its apostrophe sent plain, so it stays GSM-7', () => {
    const notice = smsNoticeFor(PREVIEW_PEOPLE.camille);

    expect(notice.text.startsWith('[Adaeze Obi et Tunde Bakare')).toBe(true);
    expect(notice.text).not.toContain('’');
    expect(notice.count.encoding).toBe('gsm7');
  });
});

describe('a text that failed', () => {
  it('gives the carrier’s reason with its code, or none', () => {
    expect(['30005', '30006', '30003', '30007', '30008', null].map(failedReason)).toEqual([
      'Number not in use (30005)',
      'Number cannot receive texts (30006)',
      'Phone off or out of signal (30003)',
      'Blocked by their network (30007)',
      'No reason given (30008)',
      'No reason given',
    ]);
  });
});
