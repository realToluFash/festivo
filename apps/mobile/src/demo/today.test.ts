import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import { ARRIVED_AT } from './today/arrived.ts';
import { INVITES_NOT_SENT, momentOf, railAt, repliesOf, sayIn, sharePercent } from './today.ts';

const i18n = createInstance();
void i18n.init({
  resources: { en: { translation: en } },
  lng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});
const t = i18n.t;

const us = sayIn('en-US');
const gb = sayIn('en-GB');

describe('Today’s dates follow the locale', () => {
  it('in the United States', () => {
    expect(us.long('2026-11-03')).toBe('Tuesday, November 3');
    expect(us.day('2026-11-05')).toBe('Thu, Nov 5');
    expect(us.day('2027-01-09')).toBe('Sat, Jan 9, 2027');
    expect(us.clock('18:00')).toBe('18:00');
    expect(us.hour('14:00')).toBe('14:00');
    expect(us.hour('21:30')).toBe('21:30');
  });

  it('in Britain', () => {
    expect(gb.long('2026-11-03')).toBe('Tuesday 3 November');
    expect(gb.clock('18:00')).toBe('18:00');
  });
});

describe('a planning day', () => {
  const plan = momentOf('plan', us, t);

  it('puts the overdue row first, and says how long overdue', () => {
    expect(plan.needs?.map(({ due, late }) => [due, late])).toEqual([
      ['3 days overdue', true],
      ['Due tomorrow', false],
      ['Due Fri, Nov 6', false],
      ['Due Mon, Jan 4, 2027', false],
    ]);
    expect(plan.lead).toBe('4 things need you.');
    expect(plan.sub).toBe('The wedding starts on Thursday.');
  });

  it('draws the wedding as one bar, and the other milestones as dots', () => {
    expect(plan.bars.map((bar) => ({ ...bar, event: bar.event.id }))).toEqual([
      { event: 'wed', start: 2, span: 3, label: '3 days', openLeft: false },
    ]);
    expect(plan.days.map(({ dots }) => dots.map(({ id }) => id))).toEqual([
      ['ireti'],
      ['wed'],
      [],
      ['ireti'],
      [],
      ['wed'],
      [],
    ]);
  });

  it('counts down to each event, and drafts come last', () => {
    expect(plan.events.map(({ count, stage }) => [count, stage])).toEqual([
      ['In 2 days', 'Final week'],
      ['In 11 days', null],
      ['In 25 days', null],
      ['Draft', null],
    ]);
  });

  it('shows only what the product can say, built now', () => {
    const now = momentOf('planNow', us, t);

    expect(now.needs).toBeNull();
    expect(now.lead).toBeNull();
    expect(now.days.flatMap(({ dots }) => dots)).toEqual([]);
    expect(now.agenda[2]?.items[0]?.time).toBe('All day');
  });
});

describe('the event day', () => {
  const day = momentOf('day', us, t);

  it('runs the wedding’s bar in from the left', () => {
    expect(day.bars.map((bar) => ({ ...bar, event: bar.event.id }))).toEqual([
      { event: 'wed', start: 0, span: 2, label: 'day 2 of 3', openLeft: true },
    ]);
    expect(day.events[0]).toMatchObject({ count: 'Day 2 of 3', live: true, stage: null });
    expect(day.events[1]).toMatchObject({ count: 'In 8 days', stage: null });
  });

  it('places Now between drinks and dinner', () => {
    expect(day.now?.rail.map(({ state }) => state)).toEqual([
      'done',
      'done',
      'now',
      'next',
      'later',
      'later',
    ]);
    expect(day.now?.at).toBeCloseTo((2 + 10 / 120) / 5);
    expect(day.now?.ends).toBe('Ends tomorrow, Sat, Nov 7 at 15:00');
    expect(day.now?.live).toBe('Day 2 of 3 · The Landmark, London');
    expect(day.eyebrow).toBe('Friday, November 6');
  });

  it('draws the built Now on day 1 for the door’s states, with the wedding’s days still to come', () => {
    const door = momentOf('dayNow', us, t, { at: ARRIVED_AT.live });

    expect(door.time).toBe('16:05');
    expect(door.now?.live).toBe('Day 1 of 3 · The Landmark, London');
    expect(door.now?.ends).toBe('Ends Sat, Nov 7 at 15:00');
    expect(door.agenda.map(({ day }) => day)).toEqual(['Today', 'Fri, Nov 6', 'Sat, Nov 7']);
    expect(momentOf('dayNow', us, t).agenda.map(({ day }) => day)).toEqual(['Today', 'Sat, Nov 7']);
  });
});

describe('each event’s replies line, from the guests Events counts (sc-23284)', () => {
  it('reads coming and the share replied for each event, and nothing for a draft', () => {
    expect(momentOf('plan', us, t).events.map(({ ready }) => ready)).toEqual([
      { words: '96 coming · 82% replied', percent: 82 },
      { words: '31 coming · 63% replied', percent: 63 },
      { words: '20 coming · 58% replied', percent: 58 },
      null,
    ]);
    expect(repliesOf('draft')).toBeNull();
  });

  it('rounds to the nearest percent, with 100% only for everyone and 0% only for nobody', () => {
    expect([sharePercent(1, 300), sharePercent(151, 152), sharePercent(152, 152)]).toEqual([
      1, 99, 100,
    ]);
    expect([sharePercent(0, 152), sharePercent(117, 142)]).toEqual([0, 82]);
  });
});

describe('the planning day before the party’s invitations go out (?invites=none)', () => {
  const notSent = momentOf('plan', us, t, { guests: INVITES_NOT_SENT });

  it('reads Invitations not sent on the party, with no bar, and the others as before', () => {
    expect(notSent.events.map(({ ready }) => ready)).toEqual([
      { words: '96 coming · 82% replied', percent: 82 },
      { words: '31 coming · 63% replied', percent: 63 },
      { words: 'Invitations not sent', percent: 0 },
      null,
    ]);
    expect(repliesOf('party', INVITES_NOT_SENT)).toEqual({
      words: 'Invitations not sent',
      percent: 0,
    });
  });

  it('changes only the party’s line: Needs you is the timeline’s, whoever has been invited', () => {
    expect(notSent.needs).toEqual(momentOf('plan', us, t).needs);
  });
});

describe('Needs you’s rows are the timeline’s You milestones (sc-29884)', () => {
  const rows = (needing: 'overdue' | 'one' | 'none' | 'long') =>
    momentOf('plan', us, t, { needing });

  it('has one row an event, each opening that event and none with an action', () => {
    const { needs } = momentOf('plan', us, t);

    expect(needs?.map(({ event }) => event.id)).toEqual(['party', 'wed', 'ireti', 'draft']);
    expect(new Set(needs?.map(({ title }) => title))).toEqual(
      new Set(['Give final numbers to the kitchen']),
    );
    expect(needs?.every(({ action }) => action === '')).toBe(true);
  });

  it('draws every overdue form at 23:59 on the due day', () => {
    const overdue = rows('overdue');

    expect(overdue.needs?.map(({ due, late }) => [due, late])).toEqual([
      ['2 days overdue', true],
      ['1 day overdue', true],
      ['Overdue', true],
      ['Due tomorrow', false],
    ]);
    expect(overdue.lead).toBe('4 things need you.');
  });

  it('says one thing in the singular', () => {
    const one = rows('one');

    expect(one.needs?.map(({ due }) => due)).toEqual(['Due today']);
    expect(one.lead).toBe('1 thing needs you.');
  });

  it('with no rows, the tick’s empty list and no line about Needs you on the cover', () => {
    const none = rows('none');

    expect(none.needs).toEqual([]);
    expect(none.lead).toBeNull();
    expect(none.sub).toBe('The wedding starts on Thursday.');
  });

  it('keeps the whole date under a long title', () => {
    expect(rows('long').needs?.[0]?.due).toBe('Due Mon, Jan 4, 2027');
  });

  it('on the event day, has no row for the wedding under way', () => {
    expect(momentOf('day', us, t).needs?.map(({ event, due }) => [event.id, due])).toEqual([
      ['party', 'Due today'],
      ['ireti', 'Due Thu, Nov 12'],
    ]);
  });
});

describe('the quiet states', () => {
  it('a quiet week has nothing due, and says what is next', () => {
    const quiet = momentOf('quiet', us, t);

    expect(quiet.needs).toEqual([]);
    expect(quiet.lead).toBeNull();
    expect(quiet.sub).toBe('Ire Events end-of-year party starts on Sat, Nov 28.');
    expect(quiet.bars).toEqual([]);
    expect(quiet.nextUp?.when).toBe('Sat, Nov 28 · in 10 days');
    expect(quiet.events.map(({ event }) => event.id)).toEqual(['party', 'draft']);
  });

  it('a first run has no events', () => {
    const first = momentOf('first', us, t);

    expect(first.hello).toBe('Welcome, Folake');
    expect(first.events).toEqual([]);
  });
});

describe('the small rules', () => {
  it('keeps Now on the rail before the first stop and after the last', () => {
    expect(railAt(['10:00', '12:00'], '09:00')).toBe(0);
    expect(railAt(['10:00', '12:00'], '13:00')).toBe(1);
    expect(railAt(['10:00', '12:00'], '11:00')).toBe(0.5);
  });
});
