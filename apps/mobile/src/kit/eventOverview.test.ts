import type { EventCover, EventVenue } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  coverRow,
  datesRow,
  hostsRow,
  manageOf,
  scheduleLocked,
  venueRow,
} from './eventOverview.ts';

const t = ((key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

const EVENT = {
  startsAt: '2026-11-14T09:00:00+01:00',
  endsAt: '2026-11-14T23:00:00+01:00',
  timeZone: 'Europe/Madrid',
};
const venue = (name: string | null) =>
  ({ name, address: { formatted: 'Calle 1' } }) as unknown as EventVenue;
const BEFORE = new Date('2026-11-01T12:00:00Z');
const DURING = new Date('2026-11-14T12:00:00Z');

describe('manageOf', () => {
  it('offers only what the phase allows, Call off before the start and End now from it', () => {
    expect(manageOf(EVENT, 'draft', BEFORE)).toEqual(['duplicate', 'delete']);
    expect(manageOf(EVENT, 'live', BEFORE)).toEqual(['duplicate', 'pause', 'callOff', 'delete']);
    expect(manageOf(EVENT, 'happening_now', DURING)).toEqual([
      'duplicate',
      'pause',
      'endNow',
      'delete',
    ]);
    expect(manageOf(EVENT, 'finished', DURING)).toEqual(['duplicate', 'delete']);
  });
});

describe('datesRow', () => {
  it('names the zone, and the days when there is more than one', () => {
    expect(datesRow(EVENT, 'live', 'en', t).line).toBe(
      `eventPage.datesLine ${JSON.stringify({ timeZone: 'Europe/Madrid' })}`,
    );
    const long = { ...EVENT, endsAt: '2026-11-16T23:00:00+01:00' };
    expect(datesRow(long, 'live', 'en', t).line).toBe(
      `eventPage.datesLineDays ${JSON.stringify({ count: 3, timeZone: 'Europe/Madrid' })}`,
    );
  });

  it('says the schedule is locked once the event is over', () => {
    expect(scheduleLocked('finished')).toBe(true);
    expect(scheduleLocked('live')).toBe(false);
    expect(datesRow(EVENT, 'finished', 'en', t).line).toBe('eventPage.datesLocked');
  });
});

describe('hostsRow', () => {
  it('lists the hosts, or says there are none yet', () => {
    expect(hostsRow([], 'en', t)).toEqual({
      title: 'eventPage.noHosts',
      line: 'eventPage.noHostsLine',
    });
    expect(hostsRow(['Ana', 'Leo'], 'en', t)).toEqual({
      title: 'Ana and Leo',
      line: 'eventHosts.heading',
    });
  });
});

describe('venueRow', () => {
  it('leads with the name and follows with the address, else whichever there is', () => {
    expect(venueRow(null, t).title).toBe('eventPage.venueToBeConfirmed');
    expect(venueRow(venue('Finca Pilar'), t)).toEqual({
      title: 'Finca Pilar',
      line: `eventPage.venueLine ${JSON.stringify({ address: 'Calle 1' })}`,
    });
    expect(venueRow(venue(null), t)).toEqual({
      title: 'Calle 1',
      line: 'eventPage.venue',
    });
  });
});

describe('coverRow', () => {
  it("says which part of the organiser's photo shows", () => {
    expect(coverRow(null, t).title).toBe('eventPage.defaultCover');
    const cover: EventCover = { position: 10, description: null, sizes: [] };
    expect(coverRow(cover, t)).toEqual({
      title: 'eventPage.yourPhoto',
      line: `eventPage.coverLine ${JSON.stringify({ showing: 'eventCover.showing_top' })}`,
    });
  });
});
