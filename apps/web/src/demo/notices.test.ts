import { describe, expect, it } from 'vitest';

import { NOTICE_PAGES, briefingStart, cost, noticePeople } from './briefing.ts';
import {
  NO_CREDITS,
  NW,
  type Reachable,
  type Reminder,
  cardOf,
  costLine,
  previewOf,
  removalLine,
  rowLines,
  sendsOffered,
  stateOf,
} from './notices.ts';

const FRI = 'Friday, Oct 16';
const reminder = (o: Partial<Reminder> = {}): Reminder => ({
  on: true,
  next: FRI,
  sent: null,
  concluded: null,
  included: 0,
  balance: 1500,
  ...o,
});
const one = (o: Partial<Reachable> = {}): Reachable => ({
  brief: 'sent',
  shift: '17:00 to 23:00',
  mobile: '+447946000001',
  ...o,
});
const card = (o: Partial<Reminder> = {}) => cardOf(noticePeople(), reminder(o), cost);

describe('the reminder card', () => {
  it('counts the five briefed people, the one not briefed and the one nobody can reach', () => {
    expect(card()).toEqual({
      kind: 'open',
      top: 'Next on Friday, Oct 16, to 5 people as things stand.',
      cost: '2 by text or WhatsApp, using 93 of your credits.',
      short: 0,
      left: [
        '1 person has not had their briefing, so will not be reminded.',
        "1 person can't be reached.",
      ],
    });
  });

  it('says one person and many people in their own words', () => {
    expect(NW.next(FRI, 1)).toBe('Next on Friday, Oct 16, to 1 person as things stand.');
    expect(NW.sent(FRI, 1)).toBe('Sent on Friday, Oct 16, to 1 person.');
    expect(NW.sent(FRI, 5)).toBe('Sent on Friday, Oct 16, to 5 people.');
    expect(NW.notBriefed(6)).toBe('6 people have not had their briefing, so will not be reminded.');
    expect(NW.cannotReach(2)).toBe("2 people can't be reached.");
    expect(NW.short(1)).toMatch(/^1 person will not get the reminder/);
    expect(NW.short(2)).toMatch(/^2 people will not get the reminder/);
  });

  it('reads Nobody to remind yet with nobody briefed, and on an empty staff', () => {
    const none = noticePeople().map((p) => ({ ...p, brief: 'none' as const }));
    expect(cardOf(none, reminder(), cost)).toMatchObject({
      top: NW.nobody,
      cost: null,
      left: [NW.notBriefed(6), NW.cannotReach(1)],
    });
    expect(cardOf([], reminder(), cost)).toEqual({
      kind: 'open',
      top: NW.nobody,
      cost: null,
      short: 0,
      left: [],
    });
  });

  it('has nothing under what it does while the switch is off', () => {
    expect(card({ on: false })).toEqual({
      kind: 'open',
      top: null,
      cost: null,
      short: 0,
      left: [],
    });
  });

  it('keeps the Sent line once the reminder has gone, with no cost line', () => {
    expect(card({ sent: { date: FRI, count: 5 }, balance: 0 })).toMatchObject({
      top: 'Sent on Friday, Oct 16, to 5 people.',
      cost: null,
      short: 0,
    });
  });
});

describe('what the next reminder costs', () => {
  it('never counts push', () => {
    expect(previewOf([], 0, 0)).toEqual({ count: 0, included: 0, credits: 0, short: 0 });
    expect(costLine(previewOf([], 0, 0))).toBeNull();
  });

  it('picks one of three keys from what pays', () => {
    expect(card({ included: 5 })).toMatchObject({
      cost: '2 by text or WhatsApp, from your included messages.',
    });
    expect(card()).toMatchObject({ cost: '2 by text or WhatsApp, using 93 of your credits.' });
    expect(card({ included: 1 })).toMatchObject({
      cost: '2 by text or WhatsApp: 1 from your included messages, the rest using 62 of your credits.',
    });
  });

  it('uses included messages first, then each text only while the credits cover all of it', () => {
    expect(previewOf([31, 62], 1, 0)).toEqual({ count: 2, included: 1, credits: 0, short: 1 });
    expect(previewOf([62, 31], 0, 40)).toEqual({ count: 2, included: 0, credits: 31, short: 1 });
  });

  it('warns in place of the cost line when the credits fall short, counting only those not covered', () => {
    expect(card({ balance: 40 })).toMatchObject({ cost: null, short: 1 });
    expect(card({ balance: 20 })).toMatchObject({ cost: null, short: 2 });
    expect(card({ balance: 93 })).toMatchObject({ short: 0 });
  });
});

describe('once the event is Finished', () => {
  it('is the heading and one line: Sent if it had gone, else why none goes, switch on or off', () => {
    const sent = { date: FRI, count: 5 };
    expect(card({ concluded: 'ended', sent })).toEqual({
      kind: 'finished',
      line: 'Sent on Friday, Oct 16, to 5 people.',
    });
    expect(card({ concluded: 'calledOff' })).toEqual({
      kind: 'finished',
      line: 'No reminder will be sent: the event has been called off.',
    });
    expect(card({ concluded: 'ended', on: false })).toEqual({
      kind: 'finished',
      line: 'No reminder will be sent: the event has ended.',
    });
  });

  it('offers no send, and no removal message', () => {
    expect(sendsOffered(true, null)).toBe(true);
    expect(sendsOffered(true, 'calledOff')).toBe(false);
    expect(sendsOffered(true, 'ended')).toBe(false);
    expect(sendsOffered(false, null)).toBe(false);
    expect(removalLine({ ...one(), name: 'Tope Balogun' }, 'ended')).toBeNull();
  });
});

describe('the lines under Briefing', () => {
  it('waits with Goes at, a line per change and the same-message line', () => {
    const waiting = one({
      brief: 'changed',
      notice: {
        kind: 'waiting',
        at: '19:55',
        changes: [
          { field: 'start', now: '15:00', was: '17:00' },
          { field: 'job', now: 'Runner', was: 'Waiter' },
        ],
      },
    });
    expect(rowLines(waiting, null)).toEqual([
      { mark: 'waiting', words: 'Goes at 19:55' },
      { mark: null, words: 'Start 15:00 (was 17:00)' },
      { mark: null, words: 'Job Runner (was Waiter)' },
      { mark: null, words: 'Edits before then go in the same message.' },
    ]);
    expect(rowLines(waiting, 'calledOff')).toEqual([]);
    expect(NW.change({ field: 'removed' })).toBe('Taken off the shift');
  });

  it('reads each delivery state with its own mark', () => {
    expect(rowLines(one({ notice: { kind: 'quiet', day: 'Friday', at: '09:00' } }), null)).toEqual([
      { mark: 'quiet', words: 'Held for quiet hours. Goes Friday at 09:00.' },
    ]);
    const told = (by: 'push' | 'text' | 'whatsApp') =>
      rowLines(one({ notice: { kind: 'told', on: 'Thursday, Oct 15', at: '15:42', by } }), null);
    expect(told('push')).toEqual([
      { mark: 'told', words: 'Told on Thursday, Oct 15 at 15:42, by push.' },
    ]);
    expect(told('text')[0]?.words).toBe('Told on Thursday, Oct 15 at 15:42, by text.');
    expect(told('whatsApp')[0]?.words).toBe('Told on Thursday, Oct 15 at 15:42, by WhatsApp.');
    expect(rowLines(one({ notice: { kind: 'failed', reason: NO_CREDITS } }), null)).toEqual([
      { mark: 'failed', words: 'Not delivered: no credits left.' },
    ]);
  });

  it('adds Called off or Event ended beneath the delivery state', () => {
    const told = { kind: 'told', on: 'Thursday, Oct 15', at: '19:40', by: 'push' } as const;
    expect(rowLines(one({ notice: told, ending: 'calledOff' }), 'calledOff')).toEqual([
      { mark: 'told', words: 'Told on Thursday, Oct 15 at 19:40, by push.' },
      { mark: 'calledOff', words: 'Called off' },
    ]);
    expect(rowLines(one({ ending: 'ended' }), 'ended')).toEqual([
      { mark: 'ended', words: 'Event ended' },
    ]);
  });

  it('reads Can’t be reached in place of the state word for someone with no app and no mobile', () => {
    const lost = one({ brief: 'none', mobile: null });
    expect(stateOf(lost)).toBe('unreachable');
    expect(stateOf({ ...lost, app: true })).toBe('none');
    expect(stateOf({ ...lost, shift: null })).toBe('none');
    expect(rowLines(lost, null)).toEqual([
      {
        mark: 'unreachable',
        words: "Can't be reached: not signed in to the app, and no mobile number.",
      },
    ]);
  });
});

describe('removing someone', () => {
  it('names the person whose briefing went, and only while they can be reached', () => {
    expect(removalLine({ ...one(), name: 'Tope Balogun' }, null)).toBe(
      'Tope Balogun gets one last message within 15 minutes to say so, and nothing after that.',
    );
    expect(removalLine({ ...one({ brief: 'none' }), name: 'Chidi' }, null)).toBeNull();
    expect(removalLine({ ...one({ mobile: null }), name: 'Amina' }, null)).toBeNull();
  });
});

describe('the demo states', () => {
  it('opens every listed state on its own sample', () => {
    const names = NOTICE_PAGES.flatMap((page) => page.states.map((state) => state.to));
    expect(names.length).toBeGreaterThanOrEqual(19);
    for (const to of names) expect(to).toMatch(/\?state=briefingNotices/);
    expect(briefingStart('noticesCostShort').notices).not.toBeNull();
    expect(briefingStart('populated').notices).toBeNull();
  });
});
