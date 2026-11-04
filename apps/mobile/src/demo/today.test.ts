import { describe, expect, it } from 'vitest';

import { dueWords, momentOf, railAt, sayIn } from './today.ts';

const us = sayIn('en-US');
const gb = sayIn('en-GB');

describe('Today’s dates follow the locale', () => {
  it('in the United States', () => {
    expect(us.long('2026-11-03')).toBe('Tuesday, November 3');
    expect(us.day('2026-11-05')).toBe('Thu, Nov 5');
    expect(us.day('2027-01-09')).toBe('Sat, Jan 9, 2027');
    expect(us.clock('18:00')).toBe('6:00 PM');
    expect(us.hour('14:00')).toBe('2 PM');
    expect(us.hour('21:30')).toBe('9:30 PM');
  });

  it('in Britain', () => {
    expect(gb.long('2026-11-03')).toBe('Tuesday 3 November');
    expect(gb.clock('18:00')).toBe('18:00');
  });
});

describe('a planning day', () => {
  const plan = momentOf('plan', us);

  it('puts the late item first, and says how late', () => {
    expect(plan.needs?.map(({ due, late }) => [due, late])).toEqual([
      ['3 days late', true],
      ['Due tomorrow', false],
      ['Due Thu, Nov 5', false],
      ['Replies close Fri, Nov 6', false],
    ]);
    expect(plan.lead).toBe('4 things need you.');
    expect(plan.sub).toBe('The wedding starts on Friday.');
  });

  it('draws the wedding as one bar, and the other milestones as dots', () => {
    expect(plan.bars.map((bar) => ({ ...bar, event: bar.event.id }))).toEqual([
      { event: 'wed', start: 3, span: 3, label: '3 days', openLeft: false },
    ]);
    expect(plan.days.map(({ dots }) => dots.map(({ id }) => id))).toEqual([
      ['ireti'],
      [],
      ['wed'],
      ['ireti'],
      [],
      [],
      ['wed'],
    ]);
  });

  it('counts down to each event, and drafts come last', () => {
    expect(plan.events.map(({ count, stage }) => [count, stage])).toEqual([
      ['In 3 days', 'Final week'],
      ['In 11 days', null],
      ['In 25 days', null],
      ['Draft', null],
    ]);
  });

  it('shows only what the product can say, built now', () => {
    const now = momentOf('planNow', us);

    expect(now.needs).toBeNull();
    expect(now.lead).toBeNull();
    expect(now.days.flatMap(({ dots }) => dots)).toEqual([]);
    expect(now.agenda[2]?.items[0]?.time).toBe('All day');
  });
});

describe('the event day', () => {
  const day = momentOf('day', us);

  it('runs the wedding’s bar in from the left', () => {
    expect(day.bars.map((bar) => ({ ...bar, event: bar.event.id }))).toEqual([
      { event: 'wed', start: 0, span: 2, label: 'day 2 of 3', openLeft: true },
    ]);
    expect(day.events[0]).toMatchObject({ count: 'Day 2 of 3', live: true, stage: null });
    expect(day.events[1]).toMatchObject({ count: 'In 7 days', stage: 'Final week' });
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
    expect(day.now?.ends).toBe('Ends tomorrow, Sun, Nov 8 at 2:00 PM');
    expect(day.now?.live).toBe('Day 2 of 3 · The Landmark, London');
  });
});

describe('the quiet states', () => {
  it('a quiet week has nothing due, and says what is next', () => {
    const quiet = momentOf('quiet', us);

    expect(quiet.needs).toEqual([]);
    expect(quiet.bars).toEqual([]);
    expect(quiet.nextUp?.when).toBe('Sat, Nov 28 · in 10 days');
    expect(quiet.events.map(({ event }) => event.id)).toEqual(['party', 'draft']);
  });

  it('a first run has no events', () => {
    const first = momentOf('first', us);

    expect(first.hello).toBe('Welcome, Folake');
    expect(first.events).toEqual([]);
  });
});

describe('the small rules', () => {
  it('words a due date', () => {
    expect(dueWords('2026-11-03', '2026-11-02', us)).toEqual({ words: '1 day late', late: true });
    expect(dueWords('2026-11-03', '2026-11-03', us).words).toBe('Due today');
  });

  it('keeps Now on the rail before the first stop and after the last', () => {
    expect(railAt(['10:00', '12:00'], '09:00')).toBe(0);
    expect(railAt(['10:00', '12:00'], '13:00')).toBe(1);
    expect(railAt(['10:00', '12:00'], '11:00')).toBe(0.5);
  });
});
