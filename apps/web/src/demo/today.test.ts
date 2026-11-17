import { describe, expect, it } from 'vitest';

import {
  actionWords,
  addDays,
  dueWords,
  headWords,
  INVITES_NOT_SENT,
  lanesOf,
  momentOf,
  railAt,
  repliesOf,
  rowWords,
  sayIn,
  shown,
  lettersAtEveryWidth,
  weekIn,
} from './today.ts';

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

describe('Your events writes Events’ words for its days', () => {
  it('weekdays in full, and the year only on a date outside this one', () => {
    expect(momentOf('plan', gb).events.map(({ dates }) => dates)).toEqual([
      { first: 'Thursday 5 Nov', last: 'Saturday 7 Nov' },
      { first: 'Saturday 14 Nov', last: 'Sunday 15 Nov' },
      'Saturday 28 Nov',
      'Saturday, 9 Jan 2027',
    ]);
  });
});

describe('a planning day', () => {
  const plan = momentOf('plan', us);

  it('puts the overdue row first, and says it is overdue in words (sc-61015)', () => {
    expect(plan.needs?.map(({ due, late }) => [due, late])).toEqual([
      ['3 days overdue', true],
      ['Due tomorrow', false],
      ['Due tomorrow', false],
      ['Due Fri, Nov 6', false],
      ['Due Mon, Jan 4, 2027', false],
    ]);
    expect(plan.lead).toBe('5 things need you.');
    expect(plan.sub).toBe('The wedding starts on Thursday.');
  });

  it('draws the wedding as one bar, and the other milestones as dots', () => {
    expect(plan.bars).toEqual([
      { event: shown('wed'), start: 2, span: 3, label: '3 days', openLeft: false, lane: 0 },
    ]);
    expect(plan.days.map(({ dots }) => dots.map(({ mesh }) => mesh))).toEqual([
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
    expect(day.bars).toEqual([
      { event: shown('wed'), start: 0, span: 2, label: 'day 2 of 3', openLeft: true, lane: 0 },
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
  });

  it('counts the wedding as Guests A and Messaging B do, and the others as Events does', () => {
    const plan = momentOf('plan', us);

    expect(plan.events.map(({ ready }) => ready)).toEqual([
      { words: '96 coming · 82% replied', percent: 82 },
      { words: '31 coming · 63% replied', percent: 63 },
      { words: '20 coming · 58% replied', percent: 58 },
      null,
    ]);
    expect(day.events[0]?.ready).toEqual({ words: '87 of 99 arrived', percent: 87 });
    expect(day.now).toMatchObject({ arrived: 87, expected: 99 });
    expect(day.eyebrow).toBe('Friday, November 6');
  });
});

describe('the planning day before the party’s invitations go out (?invites=none)', () => {
  const notSent = momentOf('plan', us, { guests: INVITES_NOT_SENT });

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
    expect(notSent.needs).toEqual(momentOf('plan', us).needs);
  });
});

describe('an event that starts later today, not under way yet (?starts=later)', () => {
  const later = momentOf('plan', us, { later: true });

  it('stays a planning day, with no Now, and says when it starts', () => {
    expect(later.kind).toBe('plan');
    expect(later.now).toBeNull();
    expect(later.time).toBe('09:41');
    expect(later.eyebrow).toBe('Saturday, November 28');
    expect(later.sub).toBe('Ire Events end-of-year party starts today at 19:00.');
    expect(later.needs).toEqual([]);
    expect(later.lead).toBeNull();
  });

  it('counts the party as Today, not a started day, until 19:00', () => {
    const party = later.events.find(({ name }) => name === 'Ire Events end-of-year party');

    expect(party).toMatchObject({ count: 'Today', live: false, stage: null });
    expect(later.agenda).toEqual([
      expect.objectContaining({
        day: 'Today',
        today: true,
        items: [expect.objectContaining({ time: '19:00', title: 'The party starts' })],
      }),
    ]);
  });

  it('reads the planning day as before without it', () => {
    expect(momentOf('plan', us, { later: false }).sub).toBe('The wedding starts on Thursday.');
  });
});

describe('events sharing days take rows (?week=rows, sc-37302)', () => {
  const rows = momentOf('plan', us, { rows: true });
  it('puts A on days 1 to 4 and C on 5 to 7 on the top row, and B on 3 to 6 on the second', () => {
    expect(
      rows.bars.map(({ event, start, span, lane, label }) => [
        event.mesh,
        start,
        span,
        lane,
        label,
      ]),
    ).toEqual([
      ['wed', 0, 4, 0, '4 days'],
      ['ireti', 2, 4, 1, '4 days'],
      ['party', 4, 3, 0, '3 days'],
    ]);
  });

  it('keeps a dot only on the day no bar covers', () => {
    expect(rows.days.map(({ dots }) => dots.map(({ mesh }) => mesh))).toEqual([
      [],
      ['ireti'],
      [],
      [],
      [],
      [],
      [],
    ]);
  });

  it('stays a planning day: the wedding starts this evening', () => {
    expect(rows.kind).toBe('plan');
    expect(rows.now).toBeNull();
    expect(rows.sub).toBe('The wedding starts today at 18:00.');
    expect(rows.events.map(({ count }) => count)).toEqual([
      'Today',
      'In 2 days',
      'In 4 days',
      'Draft',
    ]);
  });

  it('stacks by the domain’s weekLanes: a row shared only by events that share no day, ties by id', () => {
    const today = '2026-11-03';
    const lanes = (spans: [string, number, number][]) => {
      const placed = lanesOf(
        today,
        spans.map(([id, from, to]) => ({
          id,
          first: addDays(today, from),
          last: addDays(today, to),
        })),
      );

      return spans.map(([id]) => placed.get(id));
    };

    expect(
      lanes([
        ['a', 0, 1],
        ['b', 3, 4],
      ]),
    ).toEqual([0, 0]);
    expect(
      lanes([
        ['a', 0, 2],
        ['b', 2, 4],
      ]),
    ).toEqual([0, 1]);
    expect(
      lanes([
        ['c', 0, 6],
        ['a', 0, 6],
        ['b', 0, 6],
      ]),
    ).toEqual([2, 0, 1]);
    expect(
      lanes([
        ['a', 4, 6],
        ['b', -2, 2],
        ['c', 2, 4],
      ]),
    ).toEqual([0, 0, 1]);
  });

  it('gives the rows state a Needs you its own dates agree with', () => {
    expect(rows.needs?.map(({ event, due }) => [event.mesh, due])).toEqual([
      ['party', '3 days overdue'],
      ['wed', 'Due today'],
      ['ireti', 'Due tomorrow'],
    ]);
  });

  it('reads the planning day as before without it', () => {
    expect(momentOf('plan', us, { rows: false }).bars).toHaveLength(1);
  });
});

describe('the quiet states', () => {
  it('a quiet week has nothing due, and says what is next', () => {
    const quiet = momentOf('quiet', us);

    expect(quiet.needs).toEqual([]);
    expect(quiet.lead).toBeNull();
    expect(quiet.sub).toBe('Ire Events end-of-year party starts on Sat, Nov 28.');
    expect(quiet.bars).toEqual([]);
    expect(quiet.nextUp?.when).toBe('Sat, Nov 28 · in 10 days');
    expect(quiet.events.map(({ event }) => event.mesh)).toEqual(['party', 'draft']);
  });

  it('a first run has no events', () => {
    const first = momentOf('first', us);

    expect(first.hello).toBe('Welcome, Folake');
    expect(first.events).toEqual([]);
  });
});

describe('the small rules', () => {
  it('words a due date in the event’s zone, whatever zone the reader is in', () => {
    const now = new Date('2026-11-03T23:30:00Z');

    expect(dueWords('2026-11-02T23:59:00Z', 'Europe/London', now, us)).toEqual({
      words: '1 day overdue',
      late: true,
    });
    expect(dueWords('2026-11-03T23:59:00Z', 'Europe/London', now, us).words).toBe('Due today');
    // Half past midnight in Lagos: its 23:59 on the 3rd was yesterday there.
    expect(dueWords('2026-11-03T22:59:00Z', 'Africa/Lagos', now, us).words).toBe('1 day overdue');
    expect(dueWords('2026-11-05T23:59:00Z', 'Europe/London', now, us).words).toBe('Due Thu, Nov 5');
    expect(dueWords('2026-11-05T23:59:00Z', 'Europe/London', now, gb).words).toBe('Due Thu 5 Nov');
  });

  it('keeps Now on the rail before the first stop and after the last', () => {
    expect(railAt(['10:00', '12:00'], '09:00')).toBe(0);
    expect(railAt(['10:00', '12:00'], '13:00')).toBe(1);
    expect(railAt(['10:00', '12:00'], '11:00')).toBe(0.5);
  });
});

describe('Needs you lists the timeline’s You milestones (sc-61015)', () => {
  const rows = (needing: 'one' | 'overdue' | 'none') => momentOf('plan', us, { needing });

  it('gives a kitchen row its button, read with its event, and the stand-in none', () => {
    const { needs } = momentOf('plan', us);
    const kitchen = needs?.[0];
    const band = needs?.find(({ title }) => title === 'Pay the band’s balance');

    expect(kitchen?.action).toEqual({
      label: 'Open the kitchen sheet',
      link: '/demo/events/evt-party-2/kitchen',
    });
    expect(kitchen && actionWords(kitchen)).toBe(
      'Open the kitchen sheet, Ire Events end-of-year party',
    );
    expect(kitchen && rowWords(kitchen)).toBe(
      'Give final numbers to the kitchen, Ire Events end-of-year party, 3 days overdue',
    );
    expect(band?.action).toBeNull();
    expect(band && actionWords(band)).toBeNull();
  });

  it('draws every overdue form first, at 23:59 on the due day', () => {
    const overdue = rows('overdue');

    expect(overdue.needs?.map(({ event, due, late }) => [event.mesh, due, late])).toEqual([
      ['party', '2 days overdue', true],
      ['ireti', '1 day overdue', true],
      ['draft', 'Overdue', true],
      ['wed', 'Due tomorrow', false],
      ['wed', 'Due Thu, Nov 5', false],
    ]);
    expect(overdue.lead).toBe('5 things need you.');
  });

  it('says one thing in the singular', () => {
    const one = rows('one');

    expect(one.needs?.map(({ due }) => due)).toEqual(['Due today']);
    expect(one.lead).toBe('1 thing needs you.');
    expect(headWords(1)).toBe('Needs you, 1 thing');
    expect(headWords(5)).toBe('Needs you, 5 things');
  });

  it('with no rows, the tick’s empty list and no line about Needs you on the cover', () => {
    const none = rows('none');

    expect(none.needs).toEqual([]);
    expect(none.lead).toBeNull();
    expect(none.sub).toBe('The wedding starts on Thursday.');
  });

  it('has no section on a first run, or built now', () => {
    expect(momentOf('first', us).needs).toBeNull();
    expect(momentOf('planNow', us).needs).toBeNull();
  });
});

describe('a first run for a member without Create events (?moment=firstAsk)', () => {
  it('welcomes the member looking, not the owner', () => {
    expect(momentOf('first', us, { first: 'Ana' }).hello).toBe('Welcome, Ana');
    expect(momentOf('first', us).hello).toBe('Welcome, Folake');
  });
});

describe('This week at 360 px and narrower (sc-61548)', () => {
  const week = Array.from({ length: 7 }, (_, index) => addDays('2026-11-16', index));

  it.each([
    ['en-US', 'M T W T F S S'],
    ['fr', 'L M M J V S D'],
    ['es', 'L M X J V S D'],
    ['pt', 'S T Q Q S S D'],
    ['pt-PT', 'S T Q Q S S D'],
  ])('writes the narrow weekday in %s', (locale, letters) => {
    const say = sayIn(locale);

    expect(week.map((date) => say.weekdayNarrow(date)).join(' ')).toBe(letters);
  });

  it('follows the page’s language, with each day’s full name for a screen reader', () => {
    const days = weekIn(momentOf('plan', us).days, sayIn('fr'));

    expect(days.map(({ narrow }) => narrow).join(' ')).toBe('M M J V S D L');
    expect(days.map(({ spoken, number }) => `${spoken} ${number}`)[3]).toBe('vendredi 6');
    expect(days[3]?.weekday).toBe('ven.');
  });

  it.each([
    ['pt', true],
    ['pt-PT', true],
    ['pt-BR', true],
    ['en', false],
    ['es', false],
    ['fr', false],
  ])('in %s, writes the letter at every width: %s', (language, letters) => {
    expect(lettersAtEveryWidth(language)).toBe(letters);
  });

  it('in Portuguese, reads the full weekday where the letter shows', () => {
    const days = weekIn(momentOf('plan', us).days, sayIn('pt-PT'));

    expect(days.map(({ narrow }) => narrow).join(' ')).toBe('T Q Q S S D S');
    expect(days.map(({ spoken, number }) => `${spoken} ${number}`)[1]).toBe('quarta-feira 4');
  });
});
