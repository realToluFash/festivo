import { describe, expect, it } from 'vitest';

import type { Person } from '../briefing/briefingModel.ts';
import {
  type ShiftStart,
  type ShiftState,
  SHIFT_NOTICE_BOARDS,
  SHIFT_STATES,
  SW,
  briefingFor,
  cardOf,
  delivered,
  leftOutOf,
  remindedOf,
  rowLines,
  sendsOffered,
  shiftPeople,
  shiftStart,
  shiftStateOf,
  spendOf,
  stateWordOf,
} from './shiftNoticesModel.ts';

const card = (state: ShiftState, o: Partial<ShiftStart> = {}) => {
  const s = { ...shiftStart(state), ...o };

  return cardOf({
    people: s.people,
    on: s.on,
    finished: s.finished,
    lastSent: s.lastSent,
    balance: s.balance,
    manage: s.manage,
    billing: s.billing,
  });
};

const person = (state: ShiftState, id: string): Person => {
  const found = shiftStart(state).people.find((one) => one.id === id);
  if (found == null) throw new Error(id);

  return found;
};

const words = (state: ShiftState, id: string) =>
  rowLines(person(state, id)).map((line) => line.words);

describe('the roster’s Briefing lines', () => {
  it('reads a waiting change as Goes at, a line per change, then the edits line', () => {
    expect(words('list', 'dayo')).toEqual([
      'Goes at 19:55',
      'Start 15:00 (was 17:00)',
      'Edits before then go in the same message.',
    ]);
  });

  it('reads a shift retimed, added, and the last taken off, one line per shift', () => {
    const between = (id: string) => words('several_shifts', id).slice(1, -1);

    expect(between('dayo')).toEqual(['[Saturday 15:00 to 23:00 (was 17:00 to 23:00)]']);
    expect(between('grace')).toEqual(['[Added: Sunday 12:00 to 18:00]']);
    expect(between('yusuf')).toEqual(['[Off: Saturday 18:00 to 00:00]', '[No shift for now]']);
  });

  it('reminds nobody left with no shift', () => {
    const reminded = remindedOf(shiftStart('several_shifts').people).map((one) => one.id);

    expect(reminded).not.toContain('yusuf');
    expect(reminded).toContain('grace');
  });

  it('reads one line each for held, told and not delivered', () => {
    expect(words('list', 'kelechi')).toEqual(['Held for quiet hours. Goes Friday at 09:00.']);
    expect(words('list', 'grace')).toEqual(['Told on Thursday, Oct 15 at 15:42, by push.']);
    expect(words('list', 'yusuf')).toEqual(['Not delivered: the carrier refused the number.']);
    expect(words('eve', 'kelechi')).toEqual(['Told on Friday, Oct 16 at 09:00, by WhatsApp.']);
    expect(words('event_ended', 'yusuf')[0]).toBe('Told on Saturday, Oct 17 at 16:30, by text.');
  });

  it('reads no credits left as not delivered, never as waiting', () => {
    const lines = rowLines(person('no_credits', 'kelechi'));

    expect(lines).toEqual([{ mark: 'failed', words: 'Not delivered: no credits left.' }]);
  });

  it('gives every line kind its own mark', () => {
    const marks = SHIFT_STATES.flatMap((state) =>
      shiftStart(state).people.flatMap((one) => rowLines(one).map((line) => line.mark)),
    );

    expect(new Set(marks.filter((mark) => mark != null))).toEqual(
      new Set([
        'waiting',
        'quiet',
        'push',
        'sms',
        'whatsApp',
        'failed',
        'unreachable',
        'calledOff',
        'ended',
      ]),
    );
  });

  it('says Can’t be reached in place of Not sent, with its line', () => {
    expect(stateWordOf(person('list', 'amina'))).toBe("Can't be reached");
    expect(stateWordOf(person('list', 'chidi'))).toBeNull();
    expect(words('list', 'amina')).toEqual([
      "Can't be reached: not signed in to the app, and no mobile number.",
    ]);
  });

  it('puts Called off under the delivery state, with no Goes at line', () => {
    expect(words('called_off', 'dayo')).toEqual([
      'Told on Thursday, Oct 15 at 19:40, by push.',
      'Called off',
    ]);
    expect(words('called_off', 'kelechi')).toEqual([
      'Held for quiet hours. Goes Friday at 09:00.',
      'Called off',
    ]);
    expect(words('called_off', 'chidi')).toEqual([]);
    for (const one of shiftStart('called_off').people)
      expect(rowLines(one).some((line) => line.mark === 'waiting')).toBe(false);
  });

  it('marks Event ended only on shifts still to start at End now', () => {
    const ended = shiftStart('event_ended')
      .people.filter((one) => one.ended === 'ended')
      .map((one) => one.id);

    expect(ended).toEqual(['tope', 'yusuf']);
    expect(words('event_ended', 'grace')).toEqual(['Told on Friday, Oct 16 at 21:25, by push.']);
  });
});

describe('the reminder card', () => {
  it('counts the briefed and reachable, and names who is left out', () => {
    const people = shiftStart('list').people;

    expect(remindedOf(people).map((one) => one.id)).toEqual([
      'dayo',
      'grace',
      'kelechi',
      'tope',
      'yusuf',
    ]);
    expect(leftOutOf(people)).toEqual({ notBriefed: 1, unreachable: 1 });
    expect(card('list')).toEqual({
      only: null,
      control: 'switch',
      what: SW.what('10:00'),
      next: 'Next on Friday, Oct 16, to 5 people as things stand.',
      cost: '2 by text or WhatsApp, using 93 of your credits.',
      shortfall: null,
      leftOut: [
        '1 person has not had their briefing, so will not be reminded.',
        "1 person can't be reached.",
      ],
    });
  });

  it('counts credits only, and never names included messages', () => {
    expect(card('cost_credits').cost).toBe('2 by text or WhatsApp, using 93 of your credits.');
    expect(SW.cost(1, 31)).toBe('1 by text or WhatsApp, using 31 of your credits.');
  });

  it('never counts push in the cost line', () => {
    const pushOnly = shiftPeople().map((one): Person => ({ ...one, reach: 'push' }));

    expect(spendOf(remindedOf(pushOnly), 0)).toEqual({
      texts: 0,
      credits: 0,
      notCovered: 0,
    });
    expect(card('list', { people: pushOnly }).cost).toBeNull();
  });

  it('warns in place of the cost line, counting only those not covered: the app’s line for billing.manage, Ask an owner for anyone else', () => {
    expect(card('cost_short')).toMatchObject({
      cost: null,
      shortfall: { words: SW.shortfall(1), way: 'notInApp' },
    });
    expect(SW.notInApp).toBe('Credits cannot be added in the app.');
    expect(SW.shortfall(1)).toBe(
      '1 person will not get the reminder by text or WhatsApp: not enough credits. If they have the app, they still get it by push.',
    );
    expect(card('cost_short_read_only')).toMatchObject({
      control: 'word',
      cost: null,
      shortfall: { words: SW.shortfall(2), way: 'ask' },
    });
    expect(card('cost_short', { billing: false }).shortfall?.way).toBe('ask');
    expect(SW.asked(1)).toBe('The owner has been sent the link to Plan and billing.');
    expect(SW.asked(2)).toBe('The owners have been sent the link to Plan and billing.');
    expect(SW.askFailed).toBe('Not sent. Try again in a moment.');
    expect(shiftStart('cost_short_asked_one')).toMatchObject({ ask: 'sent', owners: 1 });
    expect(shiftStart('cost_short_ask_failed')).toMatchObject({ ask: 'failed', billing: false });
  });

  it('keeps the Next, cost and left-out lines for staff.read, with On as a word', () => {
    expect(card('read_only')).toMatchObject({
      control: 'word',
      next: 'Next on Friday, Oct 16, to 5 people as things stand.',
      cost: '2 by text or WhatsApp, using 93 of your credits.',
    });
    expect(card('read_only').leftOut).toHaveLength(2);
  });

  it('reads Sent on the eve, with no time, cost or warning', () => {
    expect(card('eve')).toMatchObject({
      next: 'Sent on Friday, Oct 16, to 5 people.',
      cost: null,
      shortfall: null,
      leftOut: [],
      control: 'switch',
    });
    expect(card('eve', { balance: 0 }).shortfall).toBeNull();
  });

  it('has nobody to remind before any briefing, and on an empty roster', () => {
    expect(card('none_briefed')).toMatchObject({
      next: 'Nobody to remind yet.',
      cost: null,
      leftOut: [
        '6 people have not had their briefing, so will not be reminded.',
        "1 person can't be reached.",
      ],
    });
    expect(card('empty')).toMatchObject({ next: 'Nobody to remind yet.', leftOut: [] });
  });

  it('says only what it does with the switch off', () => {
    expect(card('reminder_off')).toMatchObject({
      control: 'switch',
      next: null,
      cost: null,
      shortfall: null,
      leftOut: [],
    });
  });

  it('is its heading and one line once Finished', () => {
    const only = (state: ShiftState) => {
      const view = card(state);
      expect(view).toMatchObject({
        control: null,
        what: null,
        next: null,
        cost: null,
        shortfall: null,
        leftOut: [],
      });

      return view.only;
    };

    expect(only('called_off')).toBe('No reminder will be sent: the event has been called off.');
    expect(only('event_ended')).toBe('Sent on Friday, Oct 16, to 5 people.');
    expect(only('finished_sent')).toBe('Sent on Friday, Oct 16, to 5 people.');
    expect(only('finished_switch_off')).toBe('No reminder will be sent: the event has ended.');
    expect(only('finished_refused')).toBe('Sent on Friday, Oct 16, to 5 people.');
    expect(card('called_off', { balance: 0, on: false }).shortfall).toBeNull();
  });

  it('reads one person in the singular', () => {
    expect(SW.next('Friday, Oct 16', 1)).toBe(
      'Next on Friday, Oct 16, to 1 person as things stand.',
    );
    expect(SW.sent('Friday, Oct 16', 1)).toBe('Sent on Friday, Oct 16, to 1 person.');
    expect(SW.cost(1, 62)).toBe('1 by text or WhatsApp, using 62 of your credits.');
  });
});

describe('what the page offers', () => {
  it('hides the three sends once Finished, and only then', () => {
    for (const state of SHIFT_STATES) {
      const finished = shiftStart(state).finished;
      expect(briefingFor(shiftStart(state)).concluded).toBe(finished != null);
      expect(sendsOffered(finished)).toBe(finished == null);
    }
  });

  it('shows the End now notice only on the refused send', () => {
    expect(SHIFT_STATES.filter((state) => shiftStart(state).overNotice)).toEqual([
      'finished_refused',
    ]);
  });
});

describe('time passing', () => {
  it('delivers a waiting change and a held one, back to the state before', () => {
    const dayo = delivered(person('list', 'dayo'));
    const kelechi = delivered(person('list', 'kelechi'));

    expect(dayo.brief).toBe('read');
    expect(rowLines(dayo).map((line) => line.words)).toEqual([
      'Told on Thursday, Oct 15 at 19:55, by push.',
    ]);
    expect(kelechi.brief).toBe('read');
    expect(rowLines(kelechi).map((line) => line.words)).toEqual([
      'Told on Friday, Oct 16 at 09:00, by WhatsApp.',
    ]);
    expect(delivered(person('list', 'yusuf'))).toEqual(person('list', 'yusuf'));
  });
});

describe('the boards', () => {
  it('links every Tweak as a route parameter', () => {
    expect(SHIFT_NOTICE_BOARDS).toHaveLength(SHIFT_STATES.length);
    for (const board of SHIFT_NOTICE_BOARDS) {
      const state = /shift=([a-z_]+)/u.exec(board.href)?.[1];
      expect(shiftStateOf(state)).not.toBeNull();
    }
    expect(shiftStateOf('nope')).toBeNull();
  });

  it('has no em dash and no arrow in any word it shows', () => {
    const shown = [
      ...Object.values(SW).filter((one) => typeof one === 'string'),
      ...SHIFT_STATES.flatMap((state) =>
        shiftStart(state).people.flatMap((one) => rowLines(one).map((line) => line.words)),
      ),
    ];
    for (const one of shown) expect(one).not.toMatch(/[—→]/u);
  });
});
