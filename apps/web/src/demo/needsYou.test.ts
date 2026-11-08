import { type Milestone, wallDay } from '@soirely/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sampleEvent } from './events.ts';
import {
  KITCHEN_EVENT,
  cardMilestone,
  datesOf,
  kitchenAt,
  resetKitchen,
  seedFromEvent,
  timelineOf,
} from './kitchen.ts';
import { type NeedsState, dueWords, needRows, readerOf } from './needsYou.ts';

const LOCALE = 'en-US';
const LONDON = 'Europe/London';
const NOW = new Date('2026-11-03T09:41:00Z');

function words(at: string, now = NOW, zone = LONDON): string {
  return dueWords(at, now, zone, LOCALE).words;
}

function milestone(over: Partial<Milestone>): Milestone {
  return {
    at: '2026-11-04T23:59:00Z',
    title: 'Give final numbers to the kitchen',
    note: null,
    owner: 'you',
    area: 'menu',
    action: null,
    ...over,
  };
}

function eventOf(id: string) {
  const event = sampleEvent(id);

  if (event == null) throw new Error(`no sample event ${id}`);

  return event;
}

/** The card as the page builds it: the event's dates, read by the state's reader. */
function rowsOn(id: string, state: string) {
  seedFromEvent(state);
  const event = eventOf(id);
  const reader = readerOf(state.startsWith('needsYou') ? (state as NeedsState) : null);

  return needRows(timelineOf(event, NOW), reader, NOW, event.timeZone, LOCALE);
}

afterEach(() => {
  resetKitchen();
  vi.unstubAllEnvs();
});

describe('the due words (sc-32801, in sc-29884’s forms)', () => {
  it('says today, tomorrow or the date before the moment', () => {
    expect(words('2026-11-03T23:59:00Z')).toBe('Due today');
    expect(words('2026-11-04T23:59:00Z')).toBe('Due tomorrow');
    expect(words('2026-11-13T23:59:00Z')).toBe('Due Fri, Nov 13');
  });

  it('adds the year only in another year than today', () => {
    expect(words('2027-01-13T23:59:00Z')).toBe('Due Wed, Jan 13, 2027');
  });

  it('says it is overdue on the day, then counts the days', () => {
    expect(dueWords('2026-11-03T09:00:00Z', NOW, LONDON, LOCALE)).toEqual({
      words: 'Overdue',
      late: true,
    });
    expect(words('2026-11-02T23:59:00Z')).toBe('1 day overdue');
    expect(words('2026-11-01T23:59:00Z')).toBe('2 days overdue');
  });

  it('counts in the event’s zone: an event in Lagos read from Los Angeles across midnight', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    const lagos = 'Africa/Lagos';
    const acrossMidnight = new Date('2026-11-03T23:30:00Z');

    expect(acrossMidnight.getDate()).toBe(3);
    expect(wallDay(acrossMidnight, lagos)).toBe('2026-11-04');
    expect(words('2026-11-04T23:59:00+01:00', acrossMidnight, lagos)).toBe('Due today');
    expect(words('2026-11-03T23:59:00+01:00', acrossMidnight, lagos)).toBe('1 day overdue');
  });
});

describe('the rows (sc-32801)', () => {
  const manages = ['menu.manage'];

  it('lists a You milestone only for a reader who manages its area', () => {
    const one = [milestone({})];

    expect(needRows(one, manages, NOW, LONDON, LOCALE)).toHaveLength(1);
    expect(needRows(one, ['menu.read'], NOW, LONDON, LOCALE)).toEqual([]);
  });

  it('leaves out Automatic and Event milestones', () => {
    const others = [milestone({ owner: 'automatic' }), milestone({ owner: 'event' })];

    expect(needRows(others, manages, NOW, LONDON, LOCALE)).toEqual([]);
  });

  it('lists the kitchen milestone the wedding’s dates give, with its action, and no other event’s', () => {
    expect(rowsOn(KITCHEN_EVENT, 'finalNumbers')).toEqual([
      expect.objectContaining({
        title: 'Give final numbers to the kitchen',
        due: 'Due today',
        action: { label: 'Open the kitchen sheet', link: kitchenAt(KITCHEN_EVENT) },
      }),
    ]);
    expect(rowsOn('evt-ireti-2', 'finalNumbers')).toEqual([]);
    expect(rowsOn(KITCHEN_EVENT, 'finalNumbersGiven')).toEqual([]);
  });

  it('puts the earliest first, so overdue rows lead, and breaks a tie by title', () => {
    expect(rowsOn(KITCHEN_EVENT, 'needsYouOverdue').map((row) => [row.title, row.due])).toEqual([
      ['Give final numbers to the kitchen', '2 days overdue'],
      ['Pay the band’s balance', '1 day overdue'],
      ['Agree the toasts', 'Overdue'],
      ['Confirm the cake', 'Overdue'],
    ]);
  });

  it('gives each state its rows', () => {
    const count = (state: string) => rowsOn(KITCHEN_EVENT, state).length;

    expect(count('needsYou')).toBe(4);
    expect(count('needsYouOne')).toBe(1);
    expect(count('needsYouGiven')).toBe(3);
    expect(count('needsYouReadOnly')).toBe(0);
    expect(count('live')).toBe(0);
  });

  it.each(['needsYou', 'needsYouOverdue', 'needsYouGiven', 'finalNumbers'])(
    'is one list with All dates and Next up at ?state=%s',
    (state) => {
      const rows = rowsOn(KITCHEN_EVENT, state);
      const wedding = eventOf(KITCHEN_EVENT);
      const allDates = datesOf(wedding, NOW).map(({ milestone }) => milestone.title);

      expect(rows.every((row) => allDates.includes(row.title))).toBe(true);
      expect(cardMilestone(wedding, NOW)?.title).toBe(`Next up: ${rows[0]?.title ?? ''}`);
    },
  );

  it('names the band’s balance Next up once the kitchen has its copy, with no step', () => {
    rowsOn(KITCHEN_EVENT, 'needsYouGiven');

    expect(cardMilestone(eventOf(KITCHEN_EVENT), NOW)).toEqual({
      title: 'Next up: Pay the band’s balance',
      line: 'Tue, Nov 3, 23:59 · today',
      overdue: false,
      label: null,
      link: null,
    });
  });

  it('keys each row by its area, moment and title, so two rows of one title stay apart', () => {
    const twice = [
      milestone({ title: 'Pay the balance', area: 'budget', at: '2026-11-04T09:00:00Z' }),
      milestone({ title: 'Pay the balance', area: 'budget', at: '2026-11-04T23:59:00Z' }),
    ];
    const keys = needRows(twice, ['budget.manage'], NOW, LONDON, LOCALE).map((row) => row.key);

    expect(new Set(keys).size).toBe(2);
  });
});
