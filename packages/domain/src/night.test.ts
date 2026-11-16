import { describe, expect, it } from 'vitest';

import { type NightItem, endNowShows, nightTracks, nightView } from './night.ts';

const ZONE = 'Europe/London';
const RULE = { happening: true, eventsManage: true, manage: true };

type Marks = { startedAt?: string; endedAt?: string; skipped?: boolean };

function item(
  id: string,
  planned: string,
  length: number | null,
  place: string | null = 'Ballroom',
  marks: Marks = {},
): NightItem {
  return {
    id,
    title: id,
    planned: `${planned}:00+00:00`,
    lengthMinutes: length,
    fixedTime: false,
    place,
    ownerName: null,
    startedAt: marks.startedAt == null ? null : `${marks.startedAt}:00+00:00`,
    endedAt: marks.endedAt == null ? null : `${marks.endedAt}:00+00:00`,
    skipped: marks.skipped ?? false,
  };
}

const at = (wall: string) => `${wall}:00+00:00`;

const SPEECHES = (marks: Marks = {}) => item('speeches', '2030-11-15T19:30', 20, 'Ballroom', marks);
const DANCE = (marks: Marks = {}) => item('dance', '2030-11-15T20:00', 10, 'Ballroom', marks);
const CAKE = (marks: Marks = {}) => item('cake', '2030-11-15T20:30', 15, 'Ballroom', marks);

describe('Now, Next and Later on one track (sc-3895)', () => {
  it('shows the item on, the earliest not-started item next and the rest later', () => {
    const items = [SPEECHES({ startedAt: '2030-11-15T19:32' }), DANCE(), CAKE()];
    const [track] = nightTracks(items, at('2030-11-15T19:44'));
    const view = nightView(track!, at('2030-11-15T19:44'), ZONE);

    expect(view.now?.id).toBe('speeches');
    expect(view.elapsed).toEqual({ minutes: 12, over: 0, share: 0.6 });
    expect(view.next?.item.id).toBe('dance');
    expect(view.later.map((row) => [row.item.id, row.mark])).toEqual([['cake', 'notStarted']]);
    expect(view.header).toEqual({ kind: 'onTime' });
  });

  it('counts the minutes over once an item runs past its length', () => {
    const items = [SPEECHES({ startedAt: '2030-11-15T19:30' }), DANCE()];
    const view = nightView(
      nightTracks(items, at('2030-11-15T20:04'))[0]!,
      at('2030-11-15T20:04'),
      ZONE,
    );

    expect(view.elapsed).toEqual({ minutes: 34, over: 14, share: 1 });
    expect(view.next?.expected).toBe(at('2030-11-15T20:04'));
  });

  it('keeps Next on the earliest not-started item after an out-of-order start, and shows the started one only on Now', () => {
    const items = [
      SPEECHES({ startedAt: '2030-11-15T19:30', endedAt: '2030-11-15T19:50' }),
      DANCE(),
      CAKE({ startedAt: '2030-11-15T19:52' }),
    ];
    const view = nightView(
      nightTracks(items, at('2030-11-15T19:55'))[0]!,
      at('2030-11-15T19:55'),
      ZONE,
    );

    expect(view.now?.id).toBe('cake');
    expect(view.startedBefore?.id).toBe('dance');
    expect(view.next?.item.id).toBe('dance');
    expect(view.later).toEqual([]);
  });

  it('puts the out-of-order item back in Later as Done once it is finished', () => {
    const items = [
      SPEECHES({ startedAt: '2030-11-15T19:30', endedAt: '2030-11-15T19:50' }),
      DANCE(),
      CAKE({ startedAt: '2030-11-15T19:52', endedAt: '2030-11-15T19:58' }),
    ];
    const view = nightView(
      nightTracks(items, at('2030-11-15T19:59'))[0]!,
      at('2030-11-15T19:59'),
      ZONE,
    );

    expect(view.now).toBeNull();
    expect(view.next?.item.id).toBe('dance');
    expect(view.later).toEqual([{ item: items[2], mark: 'done', at: at('2030-11-15T19:52') }]);
    expect(view.lastFinished).toEqual({ item: items[2], at: at('2030-11-15T19:58') });
  });

  it('marks a skipped Later item and takes no time for it', () => {
    const items = [
      SPEECHES({ startedAt: '2030-11-15T19:30' }),
      DANCE(),
      CAKE({ skipped: true }),
      item('last', '2030-11-15T20:45', 15),
    ];
    const view = nightView(
      nightTracks(items, at('2030-11-15T19:40'))[0]!,
      at('2030-11-15T19:40'),
      ZONE,
    );

    expect(view.later.map((row) => [row.item.id, row.mark, row.at])).toEqual([
      ['cake', 'skipped', null],
      ['last', 'notStarted', at('2030-11-15T20:45')],
    ]);
  });
});

describe('the end of the night (sc-3895)', () => {
  const ended = (end: string) => [
    SPEECHES({ startedAt: '2030-11-15T19:30', endedAt: '2030-11-15T19:50' }),
    DANCE({ startedAt: '2030-11-15T20:00', endedAt: end }),
  ];
  const endOf = (items: NightItem[]) =>
    nightView(nightTracks(items, at('2030-11-15T21:00'))[0]!, at('2030-11-15T21:00'), ZONE).end;

  it('measures the latest actual end against the planned end of the last item', () => {
    expect(endOf(ended('2030-11-15T20:22'))).toEqual({
      minutesLate: 12,
      actualEnd: at('2030-11-15T20:22'),
      plannedEnd: at('2030-11-15T20:10'),
    });
    expect(endOf(ended('2030-11-15T20:05'))?.minutesLate).toBe(-5);
    expect(endOf(ended('2030-11-15T20:10'))?.minutesLate).toBe(0);
  });

  it('measures to the last item not skipped', () => {
    expect(endOf([...ended('2030-11-15T20:10'), CAKE({ skipped: true })])?.minutesLate).toBe(0);
  });

  it('has no sentence when every item was skipped, and still lets the event end', () => {
    const items = [SPEECHES({ skipped: true }), DANCE({ skipped: true })];

    expect(endOf(items)).toEqual({ minutesLate: null, actualEnd: null, plannedEnd: null });
    expect(endNowShows(items, at('2030-11-15T21:00'), RULE)).toBe(true);
  });
});

describe('the tracks in the picker and End now (sc-3895)', () => {
  it('puts an item at 00:30 on the track of the night before', () => {
    const items = [SPEECHES(), item('carriages', '2030-11-16T00:30', 30)];
    const tracks = nightTracks(items, at('2030-11-16T00:10'));

    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.items.map((one) => one.id)).toEqual(['speeches', 'carriages']);
  });

  it('lists only the day on now, and keeps an earlier day’s track while its item is Now', () => {
    const friday = item('bar', '2030-11-15T23:30', 60, 'Foyer', { startedAt: '2030-11-15T23:30' });
    const saturday = [
      item('brunch', '2030-11-16T11:00', 60, 'Garden'),
      item('toast', '2030-11-16T12:00', 10, 'Ballroom'),
    ];

    expect(
      nightTracks([friday, ...saturday], at('2030-11-16T09:10')).map((one) => [one.day, one.place]),
    ).toEqual([
      ['2030-11-16', 'Garden'],
      ['2030-11-16', 'Ballroom'],
      ['2030-11-15', 'Foyer'],
    ]);
    expect(
      nightTracks(
        [{ ...friday, endedAt: at('2030-11-16T05:30') }, ...saturday],
        at('2030-11-16T09:10'),
      ),
    ).toHaveLength(2);
  });

  it('hides End now while another track still runs, before the last day with items, and without the permissions', () => {
    const done = [SPEECHES({ startedAt: '2030-11-15T19:30', endedAt: '2030-11-15T19:50' })];
    const foyer = item('carriages', '2030-11-15T23:00', 30, 'Foyer', {
      startedAt: '2030-11-15T23:00',
    });
    const tomorrow = item('brunch', '2030-11-16T11:00', 60, 'Garden');
    const now = at('2030-11-15T23:10');

    expect(endNowShows(done, now, RULE)).toBe(true);
    expect(endNowShows([...done, foyer], now, RULE)).toBe(false);
    expect(endNowShows([...done, tomorrow], now, RULE)).toBe(false);
    expect(endNowShows(done, now, { ...RULE, eventsManage: false })).toBe(false);
    expect(endNowShows(done, now, { ...RULE, happening: false })).toBe(false);
  });

  it('has no track on a day with nothing on it', () => {
    expect(nightTracks([SPEECHES()], at('2030-11-17T12:00'))).toEqual([]);
  });
});
