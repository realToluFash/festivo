import { describe, expect, it } from 'vitest';

import { sayIn } from '../today.ts';
import { LONG_TITLE, type RunItem, railWindow, runNowOf, trackAt } from './runOfShow.ts';

const us = sayIn('en-US');
const NAME = 'Adaeze & Tunde’s wedding';
const nowAt = (state: Parameters<typeof trackAt>[0]) => {
  const { clock, items } = trackAt(state);

  return runNowOf(NAME, items, clock, us);
};

describe('the rail’s six, on a track of ten', () => {
  const ten = Array.from({ length: 10 }, (_, index) => index + 1);

  it('starts at the item before Now', () => {
    expect(railWindow(ten, 3)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('fills from earlier items near the end', () => {
    expect(railWindow(ten, 8)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it('starts at the first when the first is Now', () => {
    expect(railWindow(ten, 0)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('shows the last six when everything is done', () => {
    expect(railWindow(ten, 10)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it('shows a track of six or fewer whole', () => {
    expect(railWindow([1, 2, 3, 4], 2)).toEqual([1, 2, 3, 4]);
  });
});

describe('an item is Now', () => {
  const on = nowAt('on');

  it('says until its actual start plus its length, and the figure from Next', () => {
    expect([on.headline, on.until, on.figure?.words]).toEqual([
      'Drinks reception',
      'until 5:30 PM',
      '10 min behind',
    ]);
    expect(on.figure?.said).toBe('10 minutes behind');
    expect(on.next).toEqual({ time: '5:30 PM', title: 'Guests take their seats' });
    expect(on.band).toBe('Now · Drinks reception, until 5:30 PM');
  });

  it('leaves the skipped item off the rail, and starts it at the item before Now', () => {
    expect(on.rail.map(({ title, state }) => [title, state])).toEqual([
      ['Photos', 'done'],
      ['Drinks reception', 'now'],
      ['Guests take their seats', 'next'],
      ['Dinner is served', 'later'],
      ['Speeches', 'later'],
      ['Cake cutting', 'later'],
    ]);
  });

  it('reads the rail as one line, each stop with its state', () => {
    expect(on.railSaid).toBe(
      '3 PM Photos, done; 4 PM Drinks reception, now; 5:20 PM Guests take their seats, next; 6 PM Dinner is served, still to come; 7:30 PM Speeches, still to come; 9 PM Cake cutting, still to come',
    );
  });

  it('runs over in whole minutes, and Next moves with it', () => {
    const over = nowAt('over');

    expect([over.until, over.figure?.words, over.next?.time, over.band]).toEqual([
      '12 min over',
      '22 min behind',
      '5:42 PM',
      'Now · Drinks reception, 12 min over',
    ]);
  });

  it('with no length, has no until line and never goes over', () => {
    const open = nowAt('open');

    expect([open.headline, open.until, open.figure?.words, open.band]).toEqual([
      'Speeches',
      null,
      'On time',
      'Now · Speeches',
    ]);
  });

  it('keeps a title of 120 characters whole', () => {
    expect(nowAt('long').headline).toBe(LONG_TITLE);
    expect(LONG_TITLE).toHaveLength(120);
  });
});

describe('nothing is Now', () => {
  it('between two items, still with Next, the figure and the rail', () => {
    const between = nowAt('between');

    expect([between.happening, between.headline, between.until, between.figure?.words]).toEqual([
      false,
      'Nothing is on',
      null,
      '18 min behind',
    ]);
    expect(between.next).toEqual({ time: '5:38 PM', title: 'Guests take their seats' });
    expect(between.rail[0]).toMatchObject({ title: 'Drinks reception', state: 'done' });
    expect(between.band).toBe('Live · Adaeze & Tunde’s wedding');
  });

  it('before the first, on time, the rail from the first item', () => {
    const before = nowAt('before');

    expect([before.headline, before.figure?.words, before.next?.title]).toEqual([
      'Nothing is on',
      'On time',
      'Guests arrive',
    ]);
    expect(before.rail.map(({ state }) => state)).toEqual([
      'next',
      'later',
      'later',
      'later',
      'later',
      'later',
    ]);
  });

  it('after the last, with no Next and no figure, the last six on the rail', () => {
    const done = nowAt('done');

    expect([done.headline, done.next, done.figure]).toEqual(['That’s everything.', null, null]);
    expect(done.rail.map(({ title }) => title)).toEqual([
      'Drinks reception',
      'Guests take their seats',
      'Dinner is served',
      'Speeches',
      'Cake cutting',
      'First dance',
    ]);
    expect(done.band).toBe('Live · Adaeze & Tunde’s wedding');
  });
});

describe('Next', () => {
  it('is the earliest not started by plan, after an out-of-order Start now', () => {
    const items: RunItem[] = [
      { planned: '18:00', title: 'Dinner', length: 60, phase: 'done' },
      { planned: '19:00', title: 'Speeches', length: 30, phase: 'waiting' },
      { planned: '19:30', title: 'Cake', length: 15, phase: 'now', started: '19:05' },
    ];

    expect(runNowOf(NAME, items, '19:10', us).next?.title).toBe('Speeches');
  });
});
