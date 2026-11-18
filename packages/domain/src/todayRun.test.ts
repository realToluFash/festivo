import { describe, expect, it } from 'vitest';

import type { NightItem } from './night.ts';
import { todayRunOf } from './todayRun.ts';

const ZONE = 'Europe/London';

type Marks = { startedAt?: string; endedAt?: string; skipped?: boolean };

const at = (wall: string) => `${wall}:00+00:00`;

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
    planned: at(planned),
    lengthMinutes: length,
    fixedTime: false,
    place,
    ownerName: null,
    startedAt: marks.startedAt == null ? null : at(marks.startedAt),
    endedAt: marks.endedAt == null ? null : at(marks.endedAt),
    skipped: marks.skipped ?? false,
  };
}

const DAY = '2030-11-15';

/** Ten items an hour apart from 12:00, each 30 minutes long; the first `done` are done, the next one started on time when `on`. */
function ten(done: number, on: boolean): NightItem[] {
  return Array.from({ length: 10 }, (_, index) => {
    const hour = String(12 + index).padStart(2, '0');
    const planned = `${DAY}T${hour}:00`;
    const marks: Marks =
      index < done
        ? { startedAt: planned, endedAt: `${DAY}T${hour}:30` }
        : index === done && on
          ? { startedAt: planned }
          : {};

    return item(`i${index + 1}`, planned, 30, 'Ballroom', marks);
  });
}

const railIds = (items: NightItem[], clock: string) =>
  todayRunOf(items, at(clock), ZONE)?.rail.map((stop) => stop.item.id);

describe('which track Today follows (sc-29875)', () => {
  it('follows the track with an item Now', () => {
    const items = [
      item('dinner', `${DAY}T18:00`, 60, 'Ballroom'),
      item('carriages', `${DAY}T17:00`, 60, 'Foyer', { startedAt: `${DAY}T17:05` }),
    ];

    expect(todayRunOf(items, at(`${DAY}T17:20`), ZONE)?.track.place).toBe('Foyer');
  });

  it('with two Now, follows the earliest actual start, then the place name', () => {
    const items = [
      item('dinner', `${DAY}T18:00`, 60, 'Ballroom', { startedAt: `${DAY}T18:10` }),
      item('carriages', `${DAY}T18:00`, 60, 'Foyer', { startedAt: `${DAY}T18:02` }),
    ];

    expect(todayRunOf(items, at(`${DAY}T18:20`), ZONE)?.track.place).toBe('Foyer');

    const tied = [
      item('dinner', `${DAY}T18:00`, 60, 'Ballroom', { startedAt: `${DAY}T18:02` }),
      item('carriages', `${DAY}T18:00`, 60, 'Foyer', { startedAt: `${DAY}T18:02` }),
    ];

    expect(todayRunOf(tied, at(`${DAY}T18:20`), ZONE)?.track.place).toBe('Ballroom');
  });

  it('with none Now, follows the track whose Next is expected first', () => {
    const items = [
      item('dinner', `${DAY}T19:00`, 60, 'Ballroom'),
      item('carriages', `${DAY}T18:30`, 60, 'Foyer'),
    ];
    const run = todayRunOf(items, at(`${DAY}T17:00`), ZONE);

    expect(run?.track.place).toBe('Foyer');
    expect(run?.now).toBeNull();
    expect(run?.next?.item.id).toBe('carriages');
  });

  it('with every track done, follows the one that finished last and shows no Next', () => {
    const items = [
      item('dinner', `${DAY}T19:00`, 60, 'Ballroom', {
        startedAt: `${DAY}T19:00`,
        endedAt: `${DAY}T20:10`,
      }),
      item('carriages', `${DAY}T18:30`, 60, 'Foyer', {
        startedAt: `${DAY}T18:30`,
        endedAt: `${DAY}T20:40`,
      }),
    ];
    const run = todayRunOf(items, at(`${DAY}T21:00`), ZONE);

    expect(run?.track.place).toBe('Foyer');
    expect(run?.figure).toEqual({ kind: 'done' });
    expect(run?.next).toBeNull();
  });

  it('never follows an earlier day’s track whose item is still Now after 05:00', () => {
    const items = [
      item('forgotten', `${DAY}T22:00`, 60, 'Ballroom', { startedAt: `${DAY}T22:00` }),
      item('breakfast', '2030-11-16T09:00', 60, 'Terrace'),
    ];
    const run = todayRunOf(items, at('2030-11-16T08:00'), ZONE);

    expect(run?.track.place).toBe('Terrace');
    expect(run?.now).toBeNull();
  });

  it('keeps a 00:30 item on the night before, so at 00:30 Now still follows the night', () => {
    const items = [
      item('dance', `${DAY}T23:00`, 60, 'Ballroom', {
        startedAt: `${DAY}T23:00`,
        endedAt: '2030-11-16T00:20',
      }),
      item('carriages', '2030-11-16T00:30', 30, 'Ballroom', { startedAt: '2030-11-16T00:31' }),
    ];
    const run = todayRunOf(items, at('2030-11-16T00:40'), ZONE);

    expect(run?.track.day).toBe(DAY);
    expect(run?.now?.item.id).toBe('carriages');
  });

  it('is null on a day with no running order, so sc-29090’s Now stays', () => {
    expect(todayRunOf([], at(`${DAY}T18:00`), ZONE)).toBeNull();
    expect(
      todayRunOf([item('tomorrow', '2030-11-16T18:00', 60)], at(`${DAY}T18:00`), ZONE),
    ).toBeNull();
  });
});

describe('what Now says (sc-29875)', () => {
  it('an item Now runs until its actual start plus its length, with the run view’s figure', () => {
    const items = [
      item('drinks', `${DAY}T16:00`, 80, 'Ballroom', { startedAt: `${DAY}T16:10` }),
      item('seats', `${DAY}T17:20`, 40),
    ];
    const run = todayRunOf(items, at(`${DAY}T16:40`), ZONE);

    expect(run?.now).toEqual({ item: items[0], until: at(`${DAY}T17:30`), over: 0 });
    expect(run?.next?.expected).toBe(at(`${DAY}T17:30`));
    expect(run?.figure).toEqual({ kind: 'behind', minutes: 10 });
  });

  it('counts whole minutes over once the until time has passed', () => {
    const items = [
      item('drinks', `${DAY}T16:00`, 80, 'Ballroom', { startedAt: `${DAY}T16:10` }),
      item('seats', `${DAY}T17:20`, 40),
    ];
    const run = todayRunOf(items, `${DAY}T17:42:59+00:00`, ZONE);

    expect(run?.now?.over).toBe(12);
    expect(run?.figure).toEqual({ kind: 'behind', minutes: 22 });
  });

  it('an item with no length has no until and never goes over', () => {
    const items = [
      item('speeches', `${DAY}T19:30`, null, 'Ballroom', { startedAt: `${DAY}T19:40` }),
      item('cake', `${DAY}T21:00`, 15),
    ];
    const run = todayRunOf(items, at(`${DAY}T23:00`), ZONE);

    expect(run?.now).toEqual({ item: items[0], until: null, over: 0 });
  });

  it('nothing Now with items still to come: no Now, a Next, and On time before the first', () => {
    const run = todayRunOf(ten(0, false), at(`${DAY}T11:00`), ZONE);

    expect(run?.now).toBeNull();
    expect(run?.next?.item.id).toBe('i1');
    expect(run?.figure).toEqual({ kind: 'onTime' });
  });

  it('the last item Now: no Next, and the figure reads Last item under way', () => {
    const run = todayRunOf(ten(9, true), at(`${DAY}T21:10`), ZONE);

    expect(run?.now?.item.id).toBe('i10');
    expect(run?.next).toBeNull();
    expect(run?.figure).toEqual({ kind: 'last' });
  });

  it('after an out-of-order Start now, an earlier item still Not started is Next', () => {
    const items = [
      item('photos', `${DAY}T15:00`, 30),
      item('drinks', `${DAY}T16:00`, 60, 'Ballroom', { startedAt: `${DAY}T15:05` }),
    ];
    const run = todayRunOf(items, at(`${DAY}T15:10`), ZONE);

    expect(run?.now?.item.id).toBe('drinks');
    expect(run?.next?.item.id).toBe('photos');
    expect(run?.rail.map((stop) => stop.state)).toEqual(['next', 'now']);
  });
});

describe('the rail (sc-29875)', () => {
  it('with the 4th Now shows the 3rd to the 8th', () => {
    expect(railIds(ten(3, true), `${DAY}T15:10`)).toEqual(['i3', 'i4', 'i5', 'i6', 'i7', 'i8']);
  });

  it('with the 9th Now shows the 5th to the 10th', () => {
    expect(railIds(ten(8, true), `${DAY}T20:10`)).toEqual(['i5', 'i6', 'i7', 'i8', 'i9', 'i10']);
  });

  it('with the 1st Now shows the 1st to the 6th', () => {
    expect(railIds(ten(0, true), `${DAY}T12:10`)).toEqual(['i1', 'i2', 'i3', 'i4', 'i5', 'i6']);
  });

  it('with everything done shows the 5th to the 10th', () => {
    expect(railIds(ten(10, false), `${DAY}T22:00`)).toEqual(['i5', 'i6', 'i7', 'i8', 'i9', 'i10']);
  });

  it('with nothing on starts before Next, and marks each stop', () => {
    const run = todayRunOf(ten(4, false), at(`${DAY}T15:40`), ZONE);

    expect(run?.rail.map((stop) => [stop.item.id, stop.state])).toEqual([
      ['i4', 'done'],
      ['i5', 'next'],
      ['i6', 'later'],
      ['i7', 'later'],
      ['i8', 'later'],
      ['i9', 'later'],
    ]);
  });

  it('leaves a skipped item off', () => {
    const items = ten(2, true).map((one) => (one.id === 'i4' ? { ...one, skipped: true } : one));

    expect(railIds(items, `${DAY}T14:10`)).toEqual(['i2', 'i3', 'i5', 'i6', 'i7', 'i8']);
  });

  it('shows a track of six or fewer whole', () => {
    expect(railIds(ten(3, true).slice(0, 5), `${DAY}T15:10`)).toEqual([
      'i1',
      'i2',
      'i3',
      'i4',
      'i5',
    ]);
  });
});
