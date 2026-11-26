import type { KitchenStationsRead, MyNight } from '@soirely/api-client';
import { type EventState, eventPhase } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { openStationOf, stationRowLine, stationRowShows } from './stationWayIn.ts';

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
