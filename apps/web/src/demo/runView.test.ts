import { describe, expect, it } from 'vitest';

import {
  type RunItem,
  clockOf,
  collisionsOf,
  expected,
  figureOf,
  figureSaid,
  figureWords,
  finishItem,
  later,
  minutesOf,
  nextLine,
  runAt,
  startItem,
  trackView,
} from './runView.ts';

const item = (
  id: string,
  planned: string,
  length: number | null,
  more: Partial<RunItem> = {},
): RunItem => ({
  id,
  planned,
  title: id,
  length,
  owner: null,
  fixed: false,
  phase: 'waiting',
  ...more,
});

const hall = (state: string) => {
  const run = runAt(state);
  const track = run.tracks.find((one) => one.id === 'hall');
  if (track == null) throw new Error('no hall');

  return trackView(track, run.clock);
};

describe('the event day (sc-3895)', () => {
  it('runs 05:00 to 05:00, so 00:15 comes after 22:00', () => {
    expect(minutesOf('00:15')).toBeGreaterThan(minutesOf('22:00'));
    expect(clockOf(minutesOf('23:50') + 30)).toBe('00:20');
  });
});

describe('expected starts (sc-1404)', () => {
  it('takes the latest of planned, the expected end before, and now', () => {
    const items = [
      item('a', '18:00', 30, { phase: 'now', started: '18:10' }),
      item('b', '18:30', 10),
      item('c', '19:00', 10),
    ];
    const { starts } = expected(items, '18:20');
    expect(clockOf(starts.get('b') ?? 0)).toBe('18:40');
    expect(clockOf(starts.get('c') ?? 0)).toBe('19:00');
    expect(clockOf(expected(items, '19:30').starts.get('b') ?? 0)).toBe('19:30');
  });

  it('counts an item with no length as 0 minutes', () => {
    const items = [
      item('a', '18:00', null, { phase: 'done', started: '18:05' }),
      item('b', '18:00', 5),
    ];
    expect(clockOf(expected(items, '17:00').starts.get('b') ?? 0)).toBe('18:05');
  });

  it('keeps a fixed-time item at its planned start, and continues from its expected end', () => {
    const items = [
      item('a', '21:30', 30, { phase: 'now', started: '21:40' }),
      item('f', '22:00', 15, { fixed: true }),
      item('b', '22:15', 30),
    ];
    const { starts } = expected(items, '21:45');
    expect(clockOf(starts.get('f') ?? 0)).toBe('22:00');
    expect(clockOf(starts.get('b') ?? 0)).toBe('22:15');
  });

  it('lets an item marked out of order leave the items before it from moving those after', () => {
    const view = hall('outOfOrder');
    const welcome = view.rows.find((row) => row.item.id === 'welcome');
    const dinner = view.rows.find((row) => row.item.id === 'dinner');
    const speeches = view.rows.find((row) => row.item.id === 'speeches');
    expect(welcome?.second).toEqual({ kind: 'expected', time: '18:55' });
    expect(dinner?.before).toBe('Started before Welcome speech.');
    expect(dinner?.second).toEqual({ kind: 'started', time: '18:42' });
    expect(speeches?.second).toEqual({ kind: 'expected', time: '19:57' });
    expect(view.figure).toEqual({ kind: 'behind', minutes: 25 });
  });
});

describe('the track’s figure', () => {
  it('reads On time when nothing has started, and when the next item is not late', () => {
    expect(figureWords(hall('notStarted').figure)).toBe('On time');
    expect(figureWords(hall('onTime').figure)).toBe('On time');
  });

  it('reads N min behind from the next item’s expected start, rounded down', () => {
    expect(figureWords(hall('behind').figure)).toBe('18 min behind');
    expect(hall('behind').next).toMatchObject({ item: { id: 'speeches' }, expected: '20:13' });
  });

  it('reads Last item under way, then Everything done', () => {
    expect(figureWords(hall('last').figure)).toBe('Last item under way');
    expect(figureWords(hall('allDone').figure)).toBe('Everything done');
  });

  it('ends the table with the next item, or says the track is done', () => {
    expect(nextLine(hall('behind'))).toBe(
      'Next: Speeches at about 20:13. Next step: start it when it begins.',
    );
    expect(nextLine(hall('last'))).toBe('Nothing after this.');
    expect(nextLine(hall('allDone'))).toBe('Every item on this track is done.');
  });

  it('is said with the track’s name, in words', () => {
    expect(figureSaid('Main hall', { kind: 'behind', minutes: 1 })).toBe(
      'Main hall, 1 minute behind',
    );
    expect(figureSaid('Main hall', { kind: 'onTime' })).toBe('Main hall, on time');
  });

  it('never goes below On time when the night runs early', () => {
    const items = [
      item('a', '18:00', 30, { phase: 'done', started: '18:00', ended: '18:10' }),
      item('b', '18:30', 10),
    ];
    expect(figureOf(items, '18:12')).toEqual({ kind: 'onTime' });
  });
});

describe('the collision flag', () => {
  it('names both items when the one before would run into a fixed time', () => {
    expect(hall('collision').collisions).toEqual([
      'Cake cutting would run into Fireworks at 22:00',
    ]);
    expect(hall('onTime').collisions).toEqual([]);
  });

  it('clears once the expected times no longer collide', () => {
    const items = [
      item('Cake', '21:30', 30, { phase: 'now', started: '21:35' }),
      item('Fireworks', '22:00', 15, { fixed: true }),
    ];
    expect(collisionsOf(items, '21:40')).toHaveLength(1);
    expect(
      collisionsOf(
        items.map((one) => (one.id === 'Cake' ? { ...one, phase: 'done', ended: '21:58' } : one)),
        '21:58',
      ),
    ).toEqual([]);
  });
});

describe('the rows', () => {
  it('shows no second time when expected equals planned, and No length set for no length', () => {
    const view = hall('onTime');
    const speeches = view.rows.find((row) => row.item.id === 'speeches');
    expect(speeches?.second).toBeNull();
    expect(speeches?.lasts).toBe('No length set');
  });

  it('starts and finishes an item at the clock, and the clock moves on', () => {
    let run = runAt('notStarted');
    run = startItem(later(run, 45), 'hall', 'arrive');
    expect(run.clock).toBe('18:05');
    const arrive = run.tracks[0]?.items.find((one) => one.id === 'arrive');
    expect(arrive).toMatchObject({ phase: 'now', started: '18:05' });
    run = finishItem(later(run, 30), 'hall', 'arrive');
    expect(run.tracks[0]?.items.find((one) => one.id === 'arrive')).toMatchObject({
      phase: 'done',
      ended: '18:35',
    });
  });
});
