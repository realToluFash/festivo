import { describe, expect, it } from 'vitest';

import { exactZone, matchingZones, zoneLabel } from './timeZones.ts';

const ZONES = [
  { id: 'Africa/Lagos', city: 'Lagos', country: 'Nigeria', offset: '+01:00' },
  { id: 'Africa/Kinshasa', city: 'Kinshasa', country: 'Congo - Kinshasa', offset: '+01:00' },
  { id: 'Europe/London', city: 'London', country: 'United Kingdom', offset: '+01:00' },
  { id: 'America/Sao_Paulo', city: 'Sao Paulo', country: 'Brazil', offset: '-03:00' },
  { id: 'Asia/Dubai', city: 'Dubai', country: 'United Arab Emirates', offset: '+04:00' },
];

describe('the time zone list', () => {
  it('labels a zone by its city and offset', () => {
    expect(zoneLabel(ZONES[0]!)).toBe('Lagos (UTC+01:00)');
  });

  it('matches a city, a country, or an offset, ignoring case and accents', () => {
    expect(matchingZones(ZONES, 'lag').map((z) => z.id)).toEqual(['Africa/Lagos']);
    expect(matchingZones(ZONES, 'nigeria').map((z) => z.id)).toEqual(['Africa/Lagos']);
    expect(matchingZones(ZONES, 'São').map((z) => z.id)).toEqual(['America/Sao_Paulo']);
    expect(matchingZones(ZONES, 'UTC+01').map((z) => z.id)).toEqual([
      'Africa/Lagos',
      'Africa/Kinshasa',
      'Europe/London',
    ]);
    expect(matchingZones(ZONES, '+04').map((z) => z.id)).toEqual(['Asia/Dubai']);
  });

  it('lists everything for an empty search, and nothing for no match', () => {
    expect(matchingZones(ZONES, '  ')).toHaveLength(ZONES.length);
    expect(matchingZones(ZONES, 'Lagso')).toEqual([]);
  });

  it('takes a typed city or label as its zone', () => {
    expect(exactZone(ZONES, 'lagos')?.id).toBe('Africa/Lagos');
    expect(exactZone(ZONES, 'London (UTC+01:00)')?.id).toBe('Europe/London');
    expect(exactZone(ZONES, 'Lon')).toBeNull();
  });
});
