import type { Milestone } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { sayIn } from '../today.ts';
import { dueOf, headLabel, needsOf, rowLabel, type YouEvent } from './needsYou.ts';

const LONDON = 'Europe/London';
const us = sayIn('en-US');
const gb = sayIn('en-GB');
const day = us.day;

function milestone(at: string, overrides: Partial<Milestone> = {}): Milestone {
  return {
    at,
    title: 'Give final numbers to the kitchen',
    note: null,
    owner: 'you',
    area: 'menu',
    action: null,
    ...overrides,
  };
}

function event(name: string, overrides: Partial<YouEvent> = {}): YouEvent {
  return {
    shown: { id: name, name, mesh: 'rose', photo: null },
    startsAt: '2026-12-01T12:00:00Z',
    timeZone: LONDON,
    permissions: ['menu.read', 'menu.manage'],
    milestones: [milestone('2026-11-20T23:59:00Z')],
    ...overrides,
  };
}

const NOW = new Date('2026-11-10T09:00:00Z');

describe('who a row is for', () => {
  it('lists a You milestone for a member holding its area’s manage permission', () => {
    expect(needsOf([event('Ireti at 40')], NOW, day).map(({ title }) => title)).toEqual([
      'Give final numbers to the kitchen',
    ]);
  });

  it('lists nothing for a member holding only its area’s read permission', () => {
    expect(needsOf([event('Ireti at 40', { permissions: ['menu.read'] })], NOW, day)).toEqual([]);
  });

  it('leaves out Automatic and Event milestones', () => {
    const others = [
      milestone('2026-11-12T09:00:00Z', { owner: 'automatic', title: 'Replies close' }),
      milestone('2026-11-13T09:00:00Z', { owner: 'event', title: 'Ireti at 40 starts' }),
    ];

    expect(needsOf([event('Ireti at 40', { milestones: others })], NOW, day)).toEqual([]);
  });

  it('lists an area with no page in the app like any other, with the title it was given', () => {
    const budget = milestone('2026-11-20T23:59:00Z', { area: 'budget', title: 'Pay the band' });
    const rows = needsOf(
      [event('Ireti at 40', { milestones: [budget], permissions: ['budget.manage'] })],
      NOW,
      day,
    );

    expect(rows.map(({ title }) => title)).toEqual(['Pay the band']);
  });

  it('drops a row once its area stops returning it', () => {
    expect(needsOf([event('Ireti at 40', { milestones: [] })], NOW, day)).toEqual([]);
  });
});

describe('the due words', () => {
  const due = (at: string, now: string) => dueOf(at, LONDON, new Date(now), day);

  it('before the moment: today, tomorrow, then the date', () => {
    expect(due('2026-11-10T23:59:00Z', '2026-11-10T09:00:00Z')).toEqual({
      words: 'Due today',
      late: false,
    });
    expect(due('2026-11-11T23:59:00Z', '2026-11-10T09:00:00Z').words).toBe('Due tomorrow');
    expect(due('2026-11-13T23:59:00Z', '2026-11-10T09:00:00Z').words).toBe('Due Fri, Nov 13');
  });

  it('adds the year only when the day is in another year', () => {
    expect(due('2027-01-13T23:59:00Z', '2026-11-10T09:00:00Z').words).toBe('Due Wed, Jan 13, 2027');
  });

  it('writes the date the reader’s way, in one format', () => {
    const written = dueOf('2026-11-13T23:59:00Z', LONDON, new Date('2026-11-10T09:00:00Z'), gb.day);

    expect(written.words).toBe('Due Fri 13 Nov');
  });

  it('once passed: Overdue on the due day, then in days', () => {
    expect(due('2026-11-10T23:59:00Z', '2026-11-10T23:59:30Z')).toEqual({
      words: 'Overdue',
      late: true,
    });
    expect(due('2026-11-10T23:59:00Z', '2026-11-11T00:00:30Z')).toEqual({
      words: '1 day overdue',
      late: true,
    });
    expect(due('2026-11-10T23:59:00Z', '2026-11-12T09:00:00Z')).toEqual({
      words: '2 days overdue',
      late: true,
    });
  });

  it('counts the days in the event’s zone, whatever zone the device is in', () => {
    const lagos = 'Africa/Lagos';
    const at = '2026-11-13T23:59:00+01:00';
    // 00:30 on the 13th in Lagos, still 15:30 on the 12th in Los Angeles.
    const acrossMidnight = new Date('2026-11-12T23:30:00Z');

    expect(dueOf(at, lagos, acrossMidnight, day).words).toBe('Due today');
    expect(dueOf(at, 'America/Los_Angeles', acrossMidnight, day).words).toBe('Due tomorrow');
  });
});

describe('the order', () => {
  const at = (date: string) => [milestone(`${date}T23:59:00Z`)];

  it('is earliest first, so overdue rows lead', () => {
    const rows = needsOf(
      [
        event('Later', { milestones: at('2026-11-20') }),
        event('Overdue', { milestones: at('2026-11-02') }),
        event('Sooner', { milestones: at('2026-11-12') }),
      ],
      NOW,
      day,
    );

    expect(rows.map((row) => [row.event.name, row.late])).toEqual([
      ['Overdue', true],
      ['Sooner', false],
      ['Later', false],
    ]);
  });

  it('breaks a tie by the event’s start, then its name', () => {
    const rows = needsOf(
      [
        event('Zainab at 30', { startsAt: '2026-12-05T12:00:00Z' }),
        event('Bisi at 50', { startsAt: '2026-12-05T12:00:00Z' }),
        event('Ade at 60', { startsAt: '2026-12-09T12:00:00Z' }),
        event('Tola at 40', { startsAt: '2026-12-01T12:00:00Z' }),
      ],
      NOW,
      day,
    );

    expect(rows.map((row) => row.event.name)).toEqual([
      'Tola at 40',
      'Bisi at 50',
      'Zainab at 30',
      'Ade at 60',
    ]);
  });
});

describe('what a screen reader says', () => {
  it('reads the heading with its count', () => {
    expect(headLabel(1)).toBe('Needs you, 1 thing');
    expect(headLabel(4)).toBe('Needs you, 4 things');
  });

  it('reads a row as one button, the due words saying it is overdue', () => {
    const [row] = needsOf(
      [event('Ade’s 40th', { milestones: [milestone('2026-11-08T23:59:00Z')] })],
      NOW,
      day,
    );

    expect(row == null ? '' : rowLabel(row)).toBe(
      'Give final numbers to the kitchen, Ade’s 40th, 2 days overdue',
    );
  });
});
