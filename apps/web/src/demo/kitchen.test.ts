import { describe, expect, it } from 'vitest';

import { CLOCKS, type SampleEvent, sampleEvent } from './events.ts';
import {
  KW,
  allergenCounts,
  apiRefuses,
  cardMilestone,
  changeLines,
  copyLine,
  datesOf,
  dueError,
  fileName,
  keepKitchen,
  kitchenMilestone,
  madeCopy,
  momentOf,
  newestFirst,
  picksLine,
  resetKitchen,
  seedFromEvent,
  sinceSlots,
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
      { id: 1, at: '2026-10-30T12:15:00Z', by: 'Folake Adeyemi' },
      { id: 2, at: '2026-11-02T17:00:00Z', by: 'Ana Souza' },
    ]);

    expect(copies.map((copy) => copyLine(copy, wedding.timeZone))).toEqual([
      'Given to the kitchen on Monday, Nov 2 at 17:00 by Ana Souza',
      'Given to the kitchen on Friday, Oct 30 at 12:15 by Folake Adeyemi',
    ]);
    expect(fileName(wedding, copies[0]!)).toBe(
      'Adaeze & Tunde’s wedding kitchen sheet 2026-11-02.pdf',
    );
  });

  it('numbers each copy as it is made, so two at the same moment are two, newest first', () => {
    const first = madeCopy([], '2026-11-03T09:41:00Z', 'Folake Adeyemi');
    const second = madeCopy([first], '2026-11-03T09:41:00Z', 'Folake Adeyemi');

    expect([first.id, second.id]).toEqual([1, 2]);
    expect(newestFirst([first, second]).map((copy) => copy.id)).toEqual([2, 1]);
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

describe('a row’s moment on All dates and Next up (sc-30413, 12 Nov)', () => {
  it('names its year only when it isn’t this year in the event’s zone', () => {
    expect(momentOf('2026-12-31T17:00:00Z', 'Europe/London', now)).not.toMatch(/2026/);
    expect(momentOf('2027-01-09T14:00:00Z', 'Europe/London', now)).toMatch(/2027.*14:00/);
    expect(momentOf('2025-06-14T11:00:00Z', 'Europe/London', now)).toMatch(/2025.*12:00/);
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
    const copy = { id: 1, at: '2026-11-03T09:41:00Z', by: 'Folake Adeyemi' };

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

describe('Give the changes to the kitchen (sc-30692)', () => {
  const since = [{ id: 2, at: '2026-11-02T17:00:00Z', by: 'Ana Souza' }];
  const held = (due: string | null, changedAt: string | null) => ({
    due,
    copies: since,
    sample: 'named' as const,
    changedAt,
  });
  const changes = 'Give the changes to the kitchen';

  it('comes back with a change, due at 23:59 on the date when it came back by then', () => {
    expect(kitchenMilestone(wedding, held('2026-11-03', '2026-11-02T20:30:00Z'), now)).toEqual({
      at: '2026-11-03T23:59:00Z',
      title: changes,
      note: null,
      owner: 'you',
      area: 'menu',
      action: { label: 'Open the kitchen sheet', link: '/demo/events/evt-wed-4/kitchen' },
    });
  });

  it('is due at the start when it came back after the date, or with no date, and never overdue', () => {
    expect(kitchenMilestone(wedding, held('2026-11-02', '2026-11-03T08:00:00Z'), now)?.at).toBe(
      wedding.startsAt,
    );
    expect(kitchenMilestone(wedding, held(null, '2026-11-02T20:30:00Z'), now)?.at).toBe(
      wedding.startsAt,
    );
    keepKitchen(held('2026-11-02', '2026-11-03T08:00:00Z'));
    expect(datesOf(wedding, now).some((one) => one.standing === 'overdue')).toBe(false);
    resetKitchen();
  });

  it('is overdue once the date passes with the change in no copy', () => {
    keepKitchen(held('2026-11-02', '2026-11-02T18:30:00Z'));
    const marked = datesOf(wedding, now).find((one) => one.milestone.title === changes);
    expect(marked?.standing).toBe('overdue');
    resetKitchen();
  });

  it('reads a moved or cleared date against when it came back', () => {
    expect(kitchenMilestone(wedding, held('2026-11-04', '2026-11-02T18:30:00Z'), now)?.at).toBe(
      '2026-11-04T23:59:00Z',
    );
    expect(kitchenMilestone(wedding, held(null, '2026-11-02T18:30:00Z'), now)?.at).toBe(
      wedding.startsAt,
    );
  });

  it('ends on a copy holding every change, at the start, and on an Ended event', () => {
    const off = { ...wedding, status: 'ended' as const, concludedAt: '2026-11-02T10:00:00Z' };
    const back = held('2026-11-03', '2026-11-02T20:30:00Z');

    expect(kitchenMilestone(wedding, held('2026-11-03', null), now)).toBeNull();
    expect(kitchenMilestone(wedding, back, CLOCKS.now)).toBeNull();
    expect(kitchenMilestone(off, back, now)).toBeNull();
  });

  it('marks a copy made with changes as opening with its changes page', () => {
    expect(madeCopy(since, '2026-11-03T09:41:00Z', 'Folake Adeyemi', true)).toEqual({
      id: 3,
      at: '2026-11-03T09:41:00Z',
      by: 'Folake Adeyemi',
      changes: true,
    });
  });

  it('heads the list with the latest copy’s moment, 24-hour, in the event’s zone', () => {
    expect(sinceSlots(since[0]!, wedding.timeZone)).toEqual({
      date: 'Monday, Nov 2',
      time: '17:00',
    });
    expect(changeLines(held('2026-11-03', null), true)).toEqual([]);
    expect(changeLines({ due: null, copies: [] }, true)).toEqual([]);
  });
});
