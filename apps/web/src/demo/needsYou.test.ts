import { describe, expect, it } from 'vitest';

import { type SampleMilestone, dueWords, needRows, sampleNeeds } from './needsYou.ts';

const LOCALE = 'en-US';
const LONDON = 'Europe/London';
const NOW = new Date('2026-11-03T09:41:00Z');

function words(at: string, now = NOW, zone = LONDON): string {
  return dueWords(at, now, zone, LOCALE).words;
}

function milestone(over: Partial<SampleMilestone>): SampleMilestone {
  return {
    at: '2026-11-04T23:59:00Z',
    title: 'Give final numbers to the kitchen',
    owner: 'you',
    area: 'menu',
    action: null,
    ...over,
  };
}

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

  it('counts in the event’s zone, read from Los Angeles across Lagos’s midnight', () => {
    const lagos = 'Africa/Lagos';
    const justAfterMidnightInLagos = new Date('2026-11-04T00:30:00+01:00');

    expect(words('2026-11-04T23:59:00+01:00', justAfterMidnightInLagos, lagos)).toBe('Due today');
    expect(words('2026-11-03T23:59:00+01:00', justAfterMidnightInLagos, lagos)).toBe(
      '1 day overdue',
    );
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

  it('puts the earliest first, so overdue rows lead, and breaks a tie by title', () => {
    const rows = needRows(
      sampleNeeds('needsYouOverdue').milestones,
      sampleNeeds('needsYouOverdue').permissions,
      NOW,
      LONDON,
      LOCALE,
    );

    expect(rows.map((row) => [row.title, row.due])).toEqual([
      ['Give final numbers to the kitchen', '2 days overdue'],
      ['Pay the band’s balance', '1 day overdue'],
      ['Agree the toasts', 'Overdue'],
      ['Confirm the cake', 'Overdue'],
    ]);
  });

  it('gives each state its sample', () => {
    const count = (state: Parameters<typeof sampleNeeds>[0]) => {
      const { milestones, permissions } = sampleNeeds(state);

      return needRows(milestones, permissions, NOW, LONDON, LOCALE).length;
    };

    expect(count('needsYou')).toBe(4);
    expect(count('needsYouOne')).toBe(1);
    expect(count('needsYouGiven')).toBe(3);
    expect(count('needsYouReadOnly')).toBe(0);
    expect(count(null)).toBe(0);
  });
});
