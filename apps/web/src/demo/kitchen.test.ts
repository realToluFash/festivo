import { describe, expect, it } from 'vitest';

import { CLOCKS, type SampleEvent, sampleEvent } from './events.ts';
import {
  KW,
  allergenCounts,
  apiRefuses,
  cardMilestone,
  copyLine,
  dueError,
  fileName,
  keepKitchen,
  kitchenMilestone,
  newestFirst,
  picksLine,
  resetKitchen,
  seedFromEvent,
  startOf,
  timelineOf,
} from './kitchen.ts';

const wedding = sampleEvent('evt-wed-4') as SampleEvent;
const now = CLOCKS.rest;

describe('Final numbers due, checked before sending (sc-30812)', () => {
  it('refuses the day the event starts and after, a new day in the past, and allows today', () => {
    expect(dueError('2026-11-05', null, wedding, now)).toBe('start');
    expect(dueError('2026-11-09', null, wedding, now)).toBe('start');
    expect(dueError('2026-11-02', '2026-11-03', wedding, now)).toBe('past');
    expect(dueError('2026-11-03', null, wedding, now)).toBeNull();
    expect(dueError('2026-11-04', null, wedding, now)).toBeNull();
    expect(dueError('', '2026-11-03', wedding, now)).toBeNull();
  });

  it('keeps a passed date editable: unchanged it is no refusal', () => {
    expect(dueError('2026-11-02', '2026-11-02', wedding, now)).toBeNull();
  });

  it('says the settled words', () => {
    expect(KW.errorStart).toBe(
      'The date cannot be on or after the day the event starts. Choose an earlier date.',
    );
    expect(KW.errorPast).toBe('The date cannot be in the past. Choose today or a later date.');
  });

  it('stands in for the API’s 422 on a day its clock has passed', () => {
    expect(apiRefuses('2026-11-03')).toBe(true);
    expect(apiRefuses('2026-11-04')).toBe(false);
  });

  it('shows the picks-close line only before the last close', () => {
    expect(picksLine('2026-11-03')).toBe('Guests can still choose until Wed, Nov 4.');
    expect(picksLine('2026-11-04')).toBeNull();
    expect(picksLine(null)).toBeNull();
  });
});

describe('the copies', () => {
  it('lists newest first, each with who and when on the 24-hour clock in the event’s zone', () => {
    const copies = newestFirst([
      { at: '2026-10-30T12:15:00Z', by: 'Folake Adeyemi' },
      { at: '2026-11-02T17:00:00Z', by: 'Ana Souza' },
    ]);

    expect(copies.map((copy) => copyLine(copy, wedding.timeZone))).toEqual([
      'Given to the kitchen on Monday, Nov 2 at 17:00 by Ana Souza',
      'Given to the kitchen on Friday, Oct 30 at 12:15 by Folake Adeyemi',
    ]);
    expect(fileName(wedding, copies[0]!)).toBe(
      'Adaeze & Tunde’s wedding kitchen sheet 2026-11-02.pdf',
    );
  });

  it('counts each allergen, naming nobody, without guests.manage', () => {
    expect(allergenCounts()).toEqual([
      ['Peanuts', 3],
      ['Shellfish', 2],
      ['Gluten', 1],
      ['Sesame', 1],
    ]);
  });
});

describe('the milestone on the timeline', () => {
  it('is a You milestone at 23:59 in the event’s zone with Open the kitchen sheet', () => {
    expect(kitchenMilestone(wedding, { due: '2026-11-03', copies: [] }, now)).toEqual({
      at: '2026-11-03T23:59:00Z',
      title: 'Give final numbers to the kitchen',
      note: null,
      owner: 'you',
      area: 'menu',
      action: { label: 'Open the kitchen sheet', link: '/demo/events/evt-wed-4/kitchen' },
    });
  });

  it('is gone with a copy, with no date, at the start, and on another event', () => {
    const copy = { at: '2026-11-03T09:41:00Z', by: 'Folake Adeyemi' };

    expect(kitchenMilestone(wedding, { due: '2026-11-03', copies: [copy] }, now)).toBeNull();
    expect(kitchenMilestone(wedding, { due: null, copies: [] }, now)).toBeNull();
    expect(kitchenMilestone(wedding, { due: '2026-11-03', copies: [] }, CLOCKS.now)).toBeNull();
    expect(
      kitchenMilestone(
        sampleEvent('evt-ireti-2') as SampleEvent,
        { due: '2026-11-03', copies: [] },
        now,
      ),
    ).toBeNull();
  });

  it('is gone on a called-off event', () => {
    const off = { ...wedding, status: 'ended' as const, concludedAt: '2026-11-02T10:00:00Z' };

    expect(kitchenMilestone(off, { due: '2026-11-03', copies: [] }, now)).toBeNull();
  });

  it('becomes the Overview card’s step while it is Next up, overdue once its moment passes', () => {
    keepKitchen({ due: '2026-11-03', copies: [] });
    expect(cardMilestone(wedding, now)).toEqual({
      title: 'Next up: Give final numbers to the kitchen',
      line: 'Tue, Nov 3, 23:59 · today',
      overdue: false,
      label: 'Open the kitchen sheet',
      link: '/demo/events/evt-wed-4/kitchen',
    });

    keepKitchen({ due: '2026-11-02', copies: [] });
    expect(cardMilestone(wedding, now)).toMatchObject({
      line: 'Mon, Nov 2, 23:59 · 1 day ago',
      overdue: true,
    });

    resetKitchen();
    expect(cardMilestone(wedding, now)).toBeNull();
    expect(timelineOf(wedding, now).map((one) => one.title)).toEqual([
      'Adaeze & Tunde’s wedding starts',
      'Adaeze & Tunde’s wedding ends',
    ]);
  });

  it('starts from a state link, and keeps what the demo holds without one', () => {
    expect(startOf('given').kitchen.copies).toHaveLength(1);
    expect(startOf(null).kitchen.copies).toHaveLength(1);
    expect(seedFromEvent('finalNumbersOverdue')).toBe(true);
    expect(startOf(null).kitchen.due).toBe('2026-11-02');
    expect(seedFromEvent('live')).toBe(false);
    expect(startOf(null).kitchen).toEqual({ due: null, copies: [] });
    resetKitchen();
  });

  it('starts empty from any other state link, on the event or the sheet', () => {
    startOf('set');
    seedFromEvent('venue');
    expect(cardMilestone(wedding, now)).toBeNull();

    startOf('set');
    expect(startOf('unknown').kitchen).toEqual({ due: null, copies: [] });
    expect(startOf(null).kitchen).toEqual({ due: null, copies: [] });
  });
});
