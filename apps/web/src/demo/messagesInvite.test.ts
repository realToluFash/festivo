import { describe, expect, it } from 'vitest';

import {
  BALANCE,
  MESSAGES_PAGES,
  MESSAGE_STATES,
  inviteCheck,
  inviteDraftOf,
  rowOf,
  seedOf,
} from './messages.ts';
import {
  FOURTEEN,
  INVITE_GROUP,
  INVITE_STATES,
  INVITE_TICKS,
  INVITE_WORLD,
  IW,
  NOTE,
  NOTE_MOST,
  NOT_YET_INVITED,
  REPLY_BY,
  TOO_LONG_NOTE,
  firstOf,
  greetingOf,
  guestAudience,
  inviteSeedOf,
  inviteSmsOf,
  noteRefusal,
  noteTooLong,
  previewPeople,
  smsParts,
  weddingAbout,
} from './messagesInvite.ts';
import { GROUPS, chipWords, countIn, countOf, refusalOf, toLine, BOOK } from './messagesTo.ts';

const ALL = { kind: 'all' } as const;
const check = (to: Parameters<typeof inviteDraftOf>[0], again = false, ticks = INVITE_TICKS) =>
  inviteCheck(
    { to, ticks, invite: { note: '', again, wrong: false, pressed: false } },
    BALANCE,
    GROUPS,
  );

describe('send invitations from the composer, the rules (sc-3971)', () => {
  it('takes the Guests demo’s fourteen Not yet invited, A to Z: Email 13, SMS 1', () => {
    expect(FOURTEEN).toHaveLength(14);
    expect(FOURTEEN[0]).toMatchObject({
      name: 'Bisi Adewale',
      greetAs: 'Auntie Bisi',
      mobile: false,
    });
    expect(FOURTEEN.at(-1)).toMatchObject({ name: 'Yusuf Ibrahim', email: false, mobile: true });
    expect(FOURTEEN.filter((one) => one.email)).toHaveLength(13);
    expect(FOURTEEN.filter((one) => one.mobile)).toHaveLength(1);
    expect(REPLY_BY).toBe('Wednesday, Nov 4');
  });

  it('counts To on an invitation as the Guests demo’s 101 main guests and its Not yet invited as 14, every other row as Messages does', () => {
    expect(countOf(ALL, GROUPS, INVITE_WORLD)).toBe(101);
    expect(countIn(['notInvited'], GROUPS, INVITE_WORLD)).toBe(14);
    expect(countIn(['notInvited'], GROUPS)).toBe(2);
    expect(countIn(['coming'], GROUPS, INVITE_WORLD)).toBe(countIn(['coming'], GROUPS));
    expect(chipWords(NOT_YET_INVITED, BOOK, INVITE_WORLD)).toBe('Not yet invited · 14');
    expect(chipWords(ALL, BOOK, INVITE_WORLD)).toBe('All guests · 101');
    expect(toLine(NOT_YET_INVITED, GROUPS)).toBe('To Guests who… Not yet invited');
  });

  it('holds one named guest: their name on the chip and the row, one person, never refused by To', () => {
    const bisi = guestAudience('bisi');

    expect(chipWords(bisi, BOOK, INVITE_WORLD)).toBe('Bisi Adewale');
    expect(toLine(bisi, GROUPS)).toBe('To Bisi Adewale');
    expect(countOf(bisi, GROUPS)).toBe(1);
    expect(refusalOf(bisi, GROUPS)).toBeNull();
  });

  it('refuses a note over 10,000 characters once trimmed, and only then', () => {
    expect(noteTooLong(NOTE)).toBe(false);
    expect(TOO_LONG_NOTE.startsWith('We are so happy to invite you')).toBe(true);
    expect(noteTooLong(TOO_LONG_NOTE)).toBe(true);
    expect(noteTooLong(`  ${'a'.repeat(NOTE_MOST)}\n\n`)).toBe(false);
    expect(noteTooLong('a'.repeat(NOTE_MOST + 1))).toBe(true);
    expect(noteRefusal(TOO_LONG_NOTE)).toBe('Shorten the note to 10,000 characters or fewer.');
    expect(noteRefusal('')).toBeNull();
  });

  it('checks the fourteen: nobody already invited, Yusuf’s two parts at Nigeria’s 62 a part', () => {
    expect(check(NOT_YET_INVITED)).toEqual({
      kind: 'check',
      count: 14,
      already: 0,
      named: [],
      alreadyAll: [],
      choose: false,
      pills: [
        { channel: 'email', count: 13 },
        { channel: 'sms', count: 1 },
      ],
      cant: 0,
      cantNames: [],
      cantAll: [],
      credits: 'Texts use 124 credits. Credits after sending: 1,376.',
      whatsApp: null,
      instead: null,
      waits: null,
    });
  });

  it('lists every one of the 87 already invited under See all, and everyone out of reach', () => {
    const some = check(ALL);
    const again = check(ALL, true);

    if (some.kind !== 'check' || again.kind !== 'check') throw new Error('refused');
    expect(some.already).toBe(87);
    expect(some.alreadyAll).toHaveLength(87);
    expect(some.alreadyAll.slice(0, 6).map((one) => one.name)).toEqual([
      'Alhaji Musa Bello',
      'Amaka Eze',
      'Beatriz Almeida',
      'Benedict Osei',
      'Bolanle Adisa',
      'Camille Dubois',
    ]);
    expect(some.alreadyAll.find((one) => one.name === 'Dr Emeka Nwosu')?.why).toEqual([
      'Invited by Folake Adeyemi, WhatsApp, Oct 9',
    ]);
    expect(some.cantAll).toEqual([]);
    expect(again.cantAll).toEqual(again.cantNames);
    const byText = check(ALL, true, { email: false, sms: true, whatsApp: false });

    if (byText.kind !== 'check') throw new Error('refused');
    expect(byText.cant).toBe(92);
    expect(byText.cantAll).toHaveLength(92);
    expect(byText.cantAll.slice(0, 2)).toEqual(byText.cantNames);
  });

  it('leaves the 87 already invited out of All guests, or sends again to all 101, main guests only', () => {
    expect(check(ALL)).toMatchObject({
      count: 14,
      already: 87,
      choose: true,
      named: [
        { name: 'Alhaji Musa Bello', why: ['Invited by Soirely’s message, Oct 12'] },
        { name: 'Amaka Eze', why: ['Invited by Soirely’s message, Oct 12'] },
      ],
      pills: [
        { channel: 'email', count: 13 },
        { channel: 'sms', count: 1 },
      ],
      cant: 0,
    });
    expect(check(ALL, true)).toMatchObject({
      count: 101,
      choose: true,
      pills: [
        { channel: 'email', count: 95 },
        { channel: 'sms', count: 9 },
      ],
      cant: 1,
      cantNames: [{ name: 'Joaquín Ruiz', why: ['No email address', 'No phone number'] }],
      credits: 'Texts use 738 credits. Credits after sending: 762.',
    });
  });

  it('sends again to a guest who already has theirs, with no choice to make', () => {
    expect(check(guestAudience('emeka'))).toMatchObject({
      count: 1,
      already: 1,
      choose: false,
      named: [{ name: 'Dr Emeka Nwosu', why: ['Invited by Folake Adeyemi, WhatsApp, Oct 9'] }],
      pills: [
        { channel: 'email', count: 1 },
        { channel: 'sms', count: 1 },
      ],
      credits: 'Texts use 18 credits. Credits after sending: 1,482.',
    });
  });

  it('counts the text with sc-1526’s 65-character link: 208 with a reply-by date, 188 without, 231 with the first text’s STOP line, two parts each', () => {
    const yusuf = FOURTEEN.find((one) => one.id === 'yusuf');

    if (yusuf == null) throw new Error('Yusuf');
    const first = inviteSmsOf(yusuf, weddingAbout());

    expect(first.text.endsWith('at [their own link]\nReply STOP to opt out.')).toBe(true);
    expect([first.chars, first.parts]).toEqual([231, 2]);
    expect(inviteSmsOf(yusuf, weddingAbout(), false)).toMatchObject({ chars: 208, parts: 2 });
    expect(inviteSmsOf(yusuf, { ...weddingAbout(), replyBy: null }, false)).toMatchObject({
      chars: 188,
      parts: 2,
    });
    expect(
      inviteSmsOf({ ...yusuf, id: 'lucia', name: 'Lucía Ortega' }, weddingAbout(), false).parts,
    ).toBe(4);
  });

  it('sends a text in parts: GSM-7 to 160 then 153 a part, anything else 70 then 67', () => {
    expect([
      smsParts('a'.repeat(160)),
      smsParts('a'.repeat(161)),
      smsParts('a'.repeat(307)),
    ]).toEqual([1, 2, 3]);
    expect(smsParts('€'.repeat(80))).toBe(1);
    expect(smsParts('€'.repeat(81))).toBe(2);
    expect([smsParts('ł'.repeat(70)), smsParts('ł'.repeat(71))]).toEqual([1, 2]);
  });

  it('refuses when nobody can be reached, in Make live’s words, one or many', () => {
    expect(check(guestAudience('joaquin'))).toEqual({
      kind: 'refused',
      count: 1,
      title: 'The invitation cannot be sent yet.',
      reason:
        'This guest cannot be reached. Add an email address or a mobile number for them in Guests.',
      cant: 1,
      cantNames: [{ name: 'Joaquín Ruiz', why: ['No email address', 'No phone number'] }],
      cantAll: [{ name: 'Joaquín Ruiz', why: ['No email address', 'No phone number'] }],
    });
    expect(
      check(NOT_YET_INVITED, false, { email: false, sms: false, whatsApp: false }),
    ).toMatchObject({
      kind: 'refused',
      title: 'The invitations cannot be sent yet.',
      reason:
        'None of the 14 guests can be reached. Add an email address or a mobile number for them in Guests.',
    });
  });

  it('turns a refusal into the check once a ticked channel reaches somebody', () => {
    const yusuf = guestAudience('yusuf');

    expect(check(yusuf, false, { email: true, sms: false, whatsApp: false }).kind).toBe('refused');
    expect(check(yusuf).kind).toBe('check');
  });

  it('names whom an unticked SMS leaves out, and charges nothing for email', () => {
    expect(
      check(NOT_YET_INVITED, false, { email: true, sms: false, whatsApp: false }),
    ).toMatchObject({
      count: 14,
      pills: [{ channel: 'email', count: 13 }],
      cant: 1,
      cantNames: [{ name: 'Yusuf Ibrahim', why: ['No email address', 'SMS is off'] }],
      credits: 'Email uses no credits.',
    });
  });

  it('greets the audience’s first guest, A to Z, by their Greet as', () => {
    expect(greetingOf(firstOf(NOT_YET_INVITED, GROUPS) ?? FOURTEEN[1]!)).toBe('Auntie Bisi');
    expect(firstOf(ALL, GROUPS)?.name).toBe('Alhaji Musa Bello');
    expect(previewPeople(guestAudience('emeka'), GROUPS).map((one) => one.name)).toEqual([
      'Dr Emeka Nwosu',
    ]);
  });

  it('lists its sixteen states in their own group, each with a seed', () => {
    const keys = MESSAGE_STATES.map((one) => one.key);
    const group = MESSAGES_PAGES.find((page) => page.name === INVITE_GROUP);
    const at = keys.indexOf('inviteWrite');

    expect(keys.slice(at, at + INVITE_STATES.length)).toEqual(INVITE_STATES.map((one) => one.key));
    expect(group?.states.map((one) => one.to)).toEqual(
      INVITE_STATES.map((one) => `/demo/events/evt-wed-4/messages?state=${one.key}`),
    );
    for (const { key } of INVITE_STATES) expect(inviteSeedOf(key), key).not.toBeNull();
    expect(inviteSeedOf('inviteCheckSeeAll')).toMatchObject({
      to: ALL,
      step: 'check',
      invite: { seeAll: 'already', again: false },
    });
  });

  it('lists a draft as Invitation, not sent yet, then the send by its reach', () => {
    expect(rowOf(seedOf('inviteWrite'), 'new', GROUPS)).toMatchObject({
      title: 'Invitation',
      line: 'To Guests who… Not yet invited · not sent yet',
    });
    expect(rowOf(seedOf('inviteWriteOne'), 'new', GROUPS).line).toBe(
      'To Bisi Adewale · not sent yet',
    );
    expect(rowOf(seedOf('inviteCountdown'), 'new', GROUPS)).toMatchObject({
      title: 'Invitation',
      line: 'Sending in 7…',
    });
    expect(rowOf(seedOf('inviteSent'), 'new', GROUPS).line).toBe('Reached 14 of 14');
  });

  it('keeps l10n’s English, every plural with its one and its other', () => {
    for (const [key, words] of Object.entries(IW)) {
      expect(words.trim(), key).not.toBe('');
      if (key.endsWith('_one')) expect(IW, key).toHaveProperty(key.replace(/_one$/u, '_other'));
      if (key.endsWith('_other')) expect(IW, key).toHaveProperty(key.replace(/_other$/u, '_one'));
    }
  });
});
