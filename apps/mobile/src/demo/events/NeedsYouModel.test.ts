import { type Milestone, wallDay } from '@soirely/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { cardStep, datesOf, shownEvent } from './EventsModel.ts';
import { CLOCKS, sampleEvent } from './EventsSample.ts';
import { seedFinalNumbers } from './FinalNumbers.ts';
import {
  type NeedsState,
  headingLabel,
  needRows,
  needsStateOf,
  readerOf,
  rowLabel,
} from './NeedsYouModel.ts';

const LOCALE = 'en-US';
const LONDON = 'Europe/London';
const NOW = new Date(CLOCKS.reader);

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

function shownOn(id: string, state: string | null) {
  seedFinalNumbers(state);
  const found = sampleEvent(id);

  if (found == null) throw new Error(`no sample event ${id}`);

  return shownEvent(found, NOW);
}

/** The card as the page builds it: the event's dates, read by the state's reader. */
function rowsOn(id: string, state: string | null) {
  const shown = shownOn(id, state);
  const reader = readerOf(needsStateOf(state as NeedsState | null));

  return needRows(datesOf(shown, NOW), reader, NOW, shown.timeZone, LOCALE);
}

afterEach(() => {
  seedFinalNumbers(null);
  vi.unstubAllEnvs();
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

  it('lists the kitchen milestone the wedding’s dates give, as Next up does, and no other event’s', () => {
    expect(rowsOn('evt-wed-4', 'finalNumbers').map((row) => [row.title, row.due])).toEqual([
      ['Give final numbers to the kitchen', 'Due today'],
    ]);
    expect(rowsOn('evt-ireti-2', 'finalNumbers')).toEqual([]);
    expect(rowsOn('evt-wed-4', 'finalNumbersGiven')).toEqual([]);
  });

  it('puts the earliest first, in Today’s words, and breaks a tie by title', () => {
    expect(rowsOn('evt-wed-4', 'needsYouOverdue').map((row) => [row.title, row.due])).toEqual([
      ['Give final numbers to the kitchen', '2 days overdue'],
      ['Pay the band’s balance', '1 day overdue'],
      ['Agree the toasts', 'Overdue'],
      ['Confirm the cake', 'Overdue'],
    ]);
  });

  it('gives each state its rows', () => {
    const count = (state: string | null) => rowsOn('evt-wed-4', state).length;

    expect(count('needsYou')).toBe(4);
    expect(count('needsYouOne')).toBe(1);
    expect(count('needsYouGiven')).toBe(3);
    expect(count('needsYouReadOnly')).toBe(0);
    expect(count(null)).toBe(0);
  });

  it.each(['needsYou', 'needsYouOverdue', 'needsYouGiven', 'finalNumbers'])(
    'reads the dates Next up reads at ?state=%s, so the two cards agree',
    (state) => {
      const [first] = rowsOn('evt-wed-4', state);

      expect(cardStep(shownOn('evt-wed-4', state), NOW, LOCALE)).toMatchObject({
        title: `Next up: ${first?.title ?? ''}`,
        you: true,
      });
    },
  );

  it('makes the band’s balance Next up once the kitchen has its copy', () => {
    expect(cardStep(shownOn('evt-wed-4', 'needsYouGiven'), NOW, LOCALE)).toEqual({
      kind: 'next',
      title: 'Next up: Pay the band’s balance',
      when: 'Tue, Nov 3, 23:59 · today',
      you: true,
      overdue: false,
    });
    expect(rowsOn('evt-wed-4', 'needsYouGiven')[0]?.due).toBe('Due today');
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

describe('a device in another zone than the event', () => {
  it('counts the days in the event’s zone: an event in Lagos read from Los Angeles across midnight', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    const lagos = 'Africa/Lagos';
    const acrossMidnight = new Date('2026-11-03T23:30:00Z');
    const rows = needRows(
      [milestone({ at: '2026-11-04T23:59:00+01:00' })],
      ['menu.manage'],
      acrossMidnight,
      lagos,
      LOCALE,
    );

    expect(acrossMidnight.getDate()).toBe(3);
    expect(wallDay(acrossMidnight, lagos)).toBe('2026-11-04');
    expect(rows.map((row) => row.due)).toEqual(['Due today']);
  });
});

describe('what a screen reader says', () => {
  it('reads the heading with its count, and no count with no rows', () => {
    expect(headingLabel(0)).toBe('Needs you');
    expect(headingLabel(1)).toBe('Needs you, 1 thing');
    expect(headingLabel(4)).toBe('Needs you, 4 things');
  });

  it('reads a row as its title and due words, with no event and no button', () => {
    const [row] = rowsOn('evt-wed-4', 'needsYou');

    expect(row == null ? '' : rowLabel(row)).toBe(
      'Give final numbers to the kitchen, 2 days overdue',
    );
  });

  it('takes only its own states from the page', () => {
    expect(needsStateOf('needsYouFailed')).toBe('needsYouFailed');
    expect(needsStateOf('live')).toBeNull();
    expect(needsStateOf(null)).toBeNull();
  });
});
