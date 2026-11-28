import { ApiError, type KitchenStationsRead, type MyNight } from '@soirely/api-client';
import { type EventState, NO_ANSWER_MS, eventPhase } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type PickStore, readPick, rememberPick } from './kitchenStation.ts';
import {
  type StationRowRead,
  afterFailedRead,
  openStationOf,
  pollStationRow,
  readStationRow,
  stationRowLine,
  stationRowShows,
} from './stationWayIn.ts';

const t = ((key: string, values?: Record<string, unknown>) =>
  key === 'station.wayIn.line'
    ? `${String(values?.station)} · ${String(values?.course)}`
    : key) as unknown as TFunction;

/** Doors at 17:00 in Lagos on the 28th, ending at 01:00 on the 29th. */
const EVENT = {
  status: 'live' as EventState,
  startsAt: '2026-11-28T17:00:00+01:00',
  endsAt: '2026-11-29T01:00:00+01:00',
  timeZone: 'Africa/Lagos',
};

const shows = (at: string, event = EVENT) =>
  stationRowShows(event, eventPhase(event, new Date(at)), new Date(at));

describe('Kitchen station on Overview shows on the event’s day (sc-95382)', () => {
  it('not at 23:59 the day before, in the event’s zone', () => {
    expect(shows('2026-11-27T23:59:00+01:00')).toBe(false);
  });

  it('from 00:00 on its first day', () => {
    expect(shows('2026-11-28T00:00:00+01:00')).toBe(true);
  });

  it('by the event’s day, not UTC’s', () => {
    const la = {
      ...EVENT,
      startsAt: '2026-11-28T17:00:00-08:00',
      endsAt: '2026-11-29T01:00:00-08:00',
      timeZone: 'America/Los_Angeles',
    };

    expect(shows('2026-11-28T07:59:00Z', la)).toBe(false);
    expect(shows('2026-11-28T08:00:00Z', la)).toBe(true);
  });

  it('past midnight until its end, and not once it is Finished', () => {
    expect(shows('2026-11-29T00:30:00+01:00')).toBe(true);
    expect(shows('2026-11-29T01:00:00+01:00')).toBe(false);
  });

  it('never for an event ended, called off before its day included', () => {
    expect(shows('2026-11-28T12:00:00+01:00', { ...EVENT, status: 'ended' })).toBe(false);
  });
});

const STATIONS: KitchenStationsRead = {
  event: 'Adaeze & Tunde’s wedding',
  you: 'Gbenga Salami',
  stations: [
    { id: 'pass', name: 'Pass', people: [] },
    { id: 'grill', name: 'Grill', people: [] },
    { id: 'cold', name: 'Cold', people: [] },
  ],
  yours: 'grill',
  fired: [],
};

const FIRED: KitchenStationsRead['fired'] = [
  { id: 'starter', name: 'Starter', firedAt: '2026-11-28T19:30:00.000+00:00' },
  { id: 'main', name: 'Main', firedAt: '2026-11-28T19:00:00.000+00:00' },
];

describe('the row names where the station opens', () => {
  it('their own station and the course fired last', () => {
    expect(stationRowLine(t, { ...STATIONS, fired: FIRED }, 'cold')).toBe('Grill · Starter');
  });

  it('their own station alone before any fire', () => {
    expect(stationRowLine(t, STATIONS, null)).toBe('Grill');
  });

  it('the last pick on this device, on no station', () => {
    expect(stationRowLine(t, { ...STATIONS, yours: null, fired: FIRED.slice(1) }, 'cold')).toBe(
      'Cold · Main',
    );
  });

  it('Pick a station, on none and with no pick, or a pick no longer a station', () => {
    expect(stationRowLine(t, { ...STATIONS, yours: null }, null)).toBe('station.wayIn.pick');
    expect(stationRowLine(t, { ...STATIONS, yours: null }, 'bar')).toBe('station.wayIn.pick');
  });
});

function memoryStore(): PickStore {
  const kept = new Map<string, string>();

  return {
    getItem: async (key) => kept.get(key) ?? null,
    setItem: async (key, value) => void kept.set(key, value),
  };
}

describe('a pick is the account’s, on that device (sc-95382, Decided 26 Nov)', () => {
  const ON_NONE = { ...STATIONS, yours: null };

  it('Pick a station for an account on no station signing in where another account picked', async () => {
    const device = memoryStore();
    await rememberPick(device, 'ada', 'e1', 'grill');

    expect(stationRowLine(t, ON_NONE, await readPick(device, 'bisi', 'e1'))).toBe(
      'station.wayIn.pick',
    );
  });

  it('the account that picked reads its pick again on signing back in', async () => {
    const device = memoryStore();
    await rememberPick(device, 'ada', 'e1', 'grill');
    await readPick(device, 'bisi', 'e1');

    expect(stationRowLine(t, ON_NONE, await readPick(device, 'ada', 'e1'))).toBe('Grill');
  });
});

describe('offline, the row keeps its line as of its last read (sc-95382)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a read that never answers gives up after NO_ANSWER_MS, and the line reads as of', async () => {
    const first = await readStationRow(t, Promise.resolve(STATIONS), Promise.resolve(null));
    const unanswered = readStationRow(t, new Promise(() => {}), Promise.resolve(null)).then(
      () => first,
      (error: unknown) => afterFailedRead(first, error),
    );
    await vi.advanceTimersByTimeAsync(NO_ANSWER_MS);

    expect(await unanswered).toEqual({ ...first, stale: true });
  });

  it('a refusal takes the row away', () => {
    const was = { line: 'Grill', at: '2026-11-28T19:00:00.000Z', stale: false };

    expect(
      afterFailedRead(was, new ApiError({ type: 'about:blank', title: 'Forbidden', status: 403 })),
    ).toBeNull();
  });
});

const refusal = () =>
  Promise.reject(new ApiError({ type: 'about:blank', title: 'Forbidden', status: 403 }));

describe('the row is read again every so often (sc-95382, sc-98893)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const READ = { line: 'Grill', at: '2026-11-28T19:00:00.000Z', stale: false };

  function polled(read: () => Promise<NonNullable<StationRowRead>>) {
    let seen: StationRowRead = null;
    const stop = pollStationRow(read, 10_000, (next) => {
      seen = next(seen);
    });

    return { stop, seen: () => seen };
  }

  it('reads at once and again at every interval, until stopped', async () => {
    const read = vi.fn(() => Promise.resolve(READ));
    const { stop, seen } = polled(read);
    await vi.advanceTimersByTimeAsync(0);

    expect(seen()).toEqual(READ);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(read).toHaveBeenCalledTimes(3);

    stop();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('a refused read is not repeated: the row goes, and nothing asks for it again', async () => {
    const read = vi.fn(refusal);
    const { seen } = polled(read);
    await vi.advanceTimersByTimeAsync(0);

    expect(seen()).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('a read that fails any other way keeps the line as of its last read, and is asked again', async () => {
    const answers = [
      () => Promise.resolve(READ),
      () => Promise.reject(new Error('offline')),
      () => Promise.resolve(READ),
    ];
    const read = vi.fn(() => (answers.shift() ?? (() => Promise.resolve(READ)))());
    const { seen } = polled(read);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(seen()).toEqual({ ...READ, stale: true });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(seen()).toEqual(READ);
    expect(read).toHaveBeenCalledTimes(3);
  });
});

const NIGHT = { station: 'Grill', dishes: true } as MyNight;

describe('Open {station} on Your night', () => {
  it('names the station Your shift shows, when it dishes and the access opens it', () => {
    expect(openStationOf(NIGHT)).toBe('Grill');
    expect(openStationOf({ ...NIGHT, station: 'Pass' })).toBe('Pass');
  });

  it('none when the read says it does not dish, or they cannot open it, or on no station', () => {
    expect(openStationOf({ ...NIGHT, dishes: false })).toBeNull();
    expect(openStationOf({ ...NIGHT, station: null, dishes: false })).toBeNull();
  });
});
