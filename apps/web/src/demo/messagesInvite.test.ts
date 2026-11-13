import { beforeEach, describe, expect, it } from 'vitest';

import { resetSent } from './invitesSent.ts';
import { type Draft, type Inbox, TICKS, changed, seedOf } from './messages.ts';
import {
  INVITE_STATES,
  LONG_NOTE,
  NOTE,
  NOT_INVITED,
  inviteAudienceOf,
  inviteCheckOf,
  inviteChipWords,
  inviteGoing,
  iw,
  noteProblem,
  smsOf,
} from './messagesInvite.ts';

const TICKED = { ...TICKS, whatsApp: false };

function draftIn(inbox: Inbox): Draft {
  if (inbox.draft == null) throw new Error('no draft');

  return inbox.draft;
}

describe('the invitation in New message (sc-3971)', () => {
  beforeEach(() => resetSent());

  it('opens on the 14 Not yet invited, filled in for Bisi Adewale, the first A to Z', () => {
    const audience = inviteAudienceOf(NOT_INVITED, {}, []);

    expect(audience.fresh).toHaveLength(14);
    expect(audience.already).toHaveLength(0);
    expect(audience.everyone[0]?.name).toBe('Bisi Adewale');
    expect(audience.everyone[0]?.greet).toBe('Auntie Bisi');
    expect(inviteChipWords(NOT_INVITED, {}, audience)).toBe('Guests who… Not yet invited · 14');
    expect(
      inviteChipWords(
        NOT_INVITED,
        { one: 'bisi' },
        inviteAudienceOf(NOT_INVITED, { one: 'bisi' }, []),
      ),
    ).toBe('Bisi Adewale');
  });

  it('checks 14 by Email 13 and SMS 1, two parts a text: 1,498 credits after', () => {
    const check = inviteCheckOf(NOT_INVITED, { again: false }, TICKED, []);

    expect(check).toMatchObject({ count: 14, already: 0, choice: false, cant: 0, refused: false });
    expect(check.pills).toEqual([
      { channel: 'email', count: 13 },
      { channel: 'sms', count: 1 },
    ]);
    expect(check.credits).toBe('Texts use 2 credits. Credits after sending: 1,498.');
  });

  it('names who already have it on All guests, leaves them out by default and sends to 156 again', () => {
    const left = inviteCheckOf({ kind: 'all' }, { again: false }, TICKED, []);
    const again = inviteCheckOf({ kind: 'all' }, { again: true }, TICKED, []);

    expect(inviteChipWords({ kind: 'all' }, {}, inviteAudienceOf({ kind: 'all' }, {}, []))).toBe(
      'All guests · 156',
    );
    expect(left).toMatchObject({ count: 14, already: 142, choice: true });
    expect(iw.many('already', left.already)).toBe('142 already have their invitation');
    expect(left.named.map((one) => `${one.name} · ${one.line}`)).toEqual([
      'Alhaji Musa Bello · Invited by Soirely’s message, Oct 12',
      'Amaka Eze · Invited by Soirely’s message, Oct 12',
    ]);
    expect(again.count).toBe(156);
    expect(again.pills).toEqual([
      { channel: 'email', count: 137 },
      { channel: 'sms', count: 40 },
    ]);
    expect(again.cant).toBe(9);
    expect(iw.many('cantBeReached', again.cant)).toBe('9 can’t be reached');
    expect(again.cantNamed.map((one) => [one.name, ...one.why].join(' · '))).toEqual([
      'Tomás Ferreira · Address is bouncing · No phone number',
      'Sophie Laurent · Unsubscribed · Texted STOP',
    ]);
    expect(again.credits).toBe('Texts use 80 credits. Credits after sending: 1,420.');
  });

  it('sends again with no choice when everyone in To has it, and refuses when nobody can be reached', () => {
    const emeka = inviteCheckOf(NOT_INVITED, { again: false, one: 'emeka' }, TICKED, []);
    const joaquin = inviteCheckOf(NOT_INVITED, { again: false, one: 'joaquin' }, TICKED, []);

    expect(emeka).toMatchObject({ count: 1, already: 1, choice: false, refused: false });
    expect(iw.many('already', 1)).toBe('1 already has their invitation');
    expect(emeka.named[0]?.line).toBe('Invited by Folake Adeyemi, WhatsApp, Oct 9');
    expect(joaquin).toMatchObject({ count: 1, refused: true });
    expect(joaquin.cantNamed).toEqual([
      { name: 'Joaquín Ruiz', why: ['No email address', 'No phone number'] },
    ]);
    expect(
      inviteCheckOf(NOT_INVITED, { again: false }, { ...TICKED, email: false, sms: false }, []),
    ).toMatchObject({ refused: true, credits: null });
  });

  it('refuses a note over 10,000 characters after trimming, and keeps the shorter one', () => {
    expect(noteProblem(NOTE)).toBeNull();
    expect(noteProblem(`  ${'a'.repeat(10000)}  `)).toBeNull();
    expect(noteProblem('a'.repeat(10001))).toBe('Shorten the note to 10,000 characters or fewer.');
    expect(noteProblem(LONG_NOTE)).not.toBeNull();
  });

  it('texts Yusuf Ibrahim in plain punctuation, 173 characters in two parts', () => {
    const sms = smsOf('Yusuf Ibrahim');

    expect(sms.text).toBe(
      "Adaeze Obi and Tunde Bakare: Yusuf Ibrahim, you're invited to Adaeze & Tunde's wedding on Thursday, Nov 5. Please reply by Wednesday, Nov 4 at [their own link]",
    );
    expect(sms.chars).toBe(173);
    expect(sms.parts).toBe(2);
  });

  it('seeds every state, counts down as its own Invitation and gives the note back on Cancel', () => {
    for (const { key } of INVITE_STATES) expect(seedOf(key).pane.kind, key).not.toBe('idle');

    const write = seedOf('inviteNote');
    const going = inviteGoing({ ...draftIn(write), step: 'check' }, []);

    expect(going).toMatchObject({ note: NOTE, count: 14, reached: 14 });

    const counting = changed(
      { ...write, draft: { ...draftIn(write), step: 'check' } },
      {
        kind: 'go',
        invite: going,
      },
    );

    expect(counting.outs.at(-1)?.invite?.count).toBe(14);

    const back = changed(counting, { kind: 'cancel' });

    expect(back.draft?.invite?.note).toBe(NOTE);
    expect(back.cancelled).toBe(true);
  });
});
