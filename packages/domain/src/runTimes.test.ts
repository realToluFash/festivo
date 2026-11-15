import { describe, expect, it } from 'vitest';

import { type RunTimesItem, runTrack, runTracks, wallAt } from './runTimes.ts';

const DAY = '2026-11-20';
const NEXT = '2026-11-21';

type Plan = [id: string, at: string, length: number | null, fixed?: boolean];

const HALL: Plan[] = [
  ['arrive', '18:00', 30],
  ['welcome', '18:30', 10],
  ['dinner', '18:40', 75],
  ['speeches', '19:55', null],
  ['dance', '21:10', 15],
  ['cake', '21:30', 30],
  ['fireworks', '22:00', 15, true],
  ['dancing', '22:15', 120],
  ['lastSong', '00:15', 15],
];

const wall = (hhmm: string) => `${hhmm < '05:00' ? NEXT : DAY}T${hhmm}`;

function hall(marks: Record<string, [string, string?]>): RunTimesItem[] {
  return HALL.map(([id, at, length, fixed = false]) => ({
    id,
    planned: wall(at),
    lengthMinutes: length,
    fixedTime: fixed,
    startedAt: marks[id] == null ? null : wall(marks[id][0]),
    endedAt: marks[id]?.[1] == null ? null : wall(marks[id][1]),
  }));
}

const SERVED: Record<string, [string, string?]> = {
  arrive: ['18:02', '18:31'],
  welcome: ['18:33', '18:44'],
};
const DINED = { ...SERVED, dinner: ['18:45', '20:02'] as [string, string] };
const DANCED: Record<string, [string, string?]> = {
  ...DINED,
  speeches: ['20:05', '21:05'],
  dance: ['21:08', '21:24'],
  cake: ['21:26', '21:58'],
  fireworks: ['22:00', '22:15'],
  dancing: ['22:16', '00:14'],
};

const expectedOf = (track: ReturnType<typeof runTrack>, id: string) =>
  track.rows.find((row) => row.item.id === id)?.expected;

describe('expected times on a track (sc-1404)', () => {
  it('reads on time, with no second time, while the night runs to plan', () => {
    const track = runTrack(hall({ ...SERVED, dinner: ['18:40'] }), wall('19:10'));

    expect(track.figure).toEqual({ kind: 'onTime' });
    expect(expectedOf(track, 'speeches')).toBeNull();
    expect(track.next?.item.id).toBe('speeches');
  });

  it('moves every later item by a late start and counts the minutes behind', () => {
    const track = runTrack(hall({ ...SERVED, dinner: ['18:58'] }), wall('19:20'));

    expect(expectedOf(track, 'speeches')).toBe(wall('20:13'));
    expect(track.figure).toEqual({ kind: 'behind', minutes: 18 });
  });

  it('never expects an item before now, and never pulls one earlier than planned', () => {
    const track = runTrack(hall({ ...DINED, speeches: ['20:05'] }), wall('21:13'));

    expect(expectedOf(track, 'dance')).toBe(wall('21:13'));
    expect(track.figure).toEqual({ kind: 'behind', minutes: 3 });

    const early = runTrack(hall({ arrive: ['18:00', '18:10'] }), wall('18:10'));
    expect(expectedOf(early, 'welcome')).toBeNull();
  });

  it('holds a fixed-time item at its planned start and flags what would run into it', () => {
    const track = runTrack(
      hall({ ...DINED, speeches: ['20:05', '21:05'], dance: ['21:25'] }),
      wall('21:32'),
    );

    expect(expectedOf(track, 'cake')).toBe(wall('21:40'));
    expect(expectedOf(track, 'fireworks')).toBeNull();
    expect(track.collisions.map(({ before, fixed }) => [before.id, fixed.id])).toEqual([
      ['cake', 'fireworks'],
    ]);
    expect(expectedOf(track, 'dancing')).toBeNull();
  });

  it('keeps items passed over by an out-of-order start where they were, and measures from the first', () => {
    const track = runTrack(hall({ arrive: ['18:02', '18:31'], dinner: ['18:42'] }), wall('18:55'));

    expect(expectedOf(track, 'welcome')).toBe(wall('18:55'));
    expect(track.figure).toEqual({ kind: 'behind', minutes: 25 });
    expect(track.rows.find((row) => row.item.id === 'dinner')?.startedBefore?.id).toBe('welcome');
    expect(expectedOf(track, 'speeches')).toBe(wall('19:57'));
  });

  it('reads on time before anything starts, last item under way, then no figure', () => {
    expect(runTrack(hall({}), wall('19:30')).figure).toEqual({ kind: 'onTime' });
    expect(runTrack(hall({ ...DANCED, lastSong: ['00:16'] }), wall('00:22')).figure).toEqual({
      kind: 'last',
    });
    expect(
      runTrack(hall({ ...DANCED, lastSong: ['00:16', '00:33'] }), wall('00:40')).figure,
    ).toEqual({ kind: 'done' });
  });

  it('runs across midnight on one track', () => {
    const track = runTrack(hall({ ...DANCED, dancing: ['22:20'] }), wall('00:18'));

    expect(expectedOf(track, 'lastSong')).toBe(wall('00:20'));
    expect(track.figure).toEqual({ kind: 'behind', minutes: 5 });
  });
});

describe('the event clock as the run view reads now (sc-1404)', () => {
  it('reads the wall clock in the event zone, 24-hour', () => {
    expect(wallAt(new Date('2026-11-20T23:30:59Z'), 'Africa/Lagos')).toBe('2026-11-21T00:30');
    expect(wallAt(new Date('2026-07-01T12:05:00Z'), 'America/New_York')).toBe('2026-07-01T08:05');
  });
});

describe('the tracks of a schedule (sc-1404)', () => {
  it('is one place on one event day, the 00:30 item on the night before', () => {
    const at = (id: string, planned: string, place: string | null) => ({
      id,
      planned,
      place,
      lengthMinutes: 10,
      fixedTime: false,
      startedAt: null,
      endedAt: null,
    });
    const tracks = runTracks([
      at('a', `${DAY}T20:00`, null),
      at('b', `${NEXT}T00:30`, null),
      at('c', `${DAY}T20:00`, 'Terrace'),
      at('d', `${NEXT}T12:00`, null),
    ]);

    expect(tracks.map((track) => [track.day, track.place, track.items.map((i) => i.id)])).toEqual([
      [DAY, null, ['a', 'b']],
      [DAY, 'Terrace', ['c']],
      [NEXT, null, ['d']],
    ]);
  });
});
