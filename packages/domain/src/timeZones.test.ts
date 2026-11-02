import { describe, expect, it } from 'vitest';

import { exactZone, formerName, matchingZones, zoneLabel, zoneValue } from './timeZones.ts';

const ZONES = [
  { id: 'Africa/Lagos', city: 'Lagos', country: 'Nigeria', offset: '+01:00' },
  { id: 'Africa/Kinshasa', city: 'Kinshasa', country: 'Congo - Kinshasa', offset: '+01:00' },
  { id: 'Europe/London', city: 'London', country: 'United Kingdom', offset: '+01:00' },
  { id: 'America/Sao_Paulo', city: 'Sao Paulo', country: 'Brazil', offset: '-03:00' },
  { id: 'Asia/Dubai', city: 'Dubai', country: 'United Arab Emirates', offset: '+04:00' },
  { id: 'Asia/Kolkata', city: 'Kolkata', country: 'India', offset: '+05:30' },
  { id: 'Asia/Kathmandu', city: 'Kathmandu', country: 'Nepal', offset: '+05:45' },
  { id: 'Australia/Sydney', city: 'Sydney', country: 'Australia', offset: '+11:00' },
  { id: 'Pacific/Tongatapu', city: 'Tongatapu', country: 'Tonga', offset: '+13:00' },
  { id: 'Etc/UTC', city: 'UTC', country: '', offset: '+00:00' },
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
    expect(matchingZones(ZONES, 'utc+4').map((z) => z.id)).toEqual(['Asia/Dubai']);
    expect(matchingZones(ZONES, '-3').map((z) => z.id)).toEqual(['America/Sao_Paulo']);
  });

  it('matches an offset as a number, never as text', () => {
    const ids = (query: string) => matchingZones(ZONES, query).map((z) => z.id);
    const plusOne = ['Africa/Lagos', 'Africa/Kinshasa', 'Europe/London'];

    expect(ids('utc+1')).toEqual(plusOne);
    expect(ids('+1')).toEqual(plusOne);
    expect(ids('GMT + 1')).toEqual(plusOne);
    expect(ids('+5')).toEqual(['Asia/Kolkata', 'Asia/Kathmandu']);
    expect(ids('+5:30')).toEqual(['Asia/Kolkata']);
    expect(ids('+0530')).toEqual(['Asia/Kolkata']);
    expect(ids('+11')).toEqual(['Australia/Sydney']);
    expect(ids('\u22123')).toEqual(['America/Sao_Paulo']);
    expect(ids('+0')).toEqual(['Etc/UTC']);
    expect(ids('01:00')).toEqual([]);
  });

  it('still finds a picked label as it is edited, without matching the offset inside it', () => {
    const ids = (query: string) => matchingZones(ZONES, query).map((z) => z.id);

    expect(ids('Lagos (UTC+01:00)')).toEqual(['Africa/Lagos']);
    expect(ids('Lagos (UTC+01:0')).toEqual(['Africa/Lagos']);
    expect(ids('(utc+1')).toEqual([]);
    expect(ids('utc+1')).not.toContain('Australia/Sydney');
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

describe('cities in the reader’s language, and the names a zone once had', () => {
  const LOCAL = [
    {
      id: 'Europe/London',
      city: 'Londres',
      ianaCity: 'London',
      aliases: ['Belfast', 'GB'],
      formerName: null,
      country: 'Royaume-Uni',
      offset: '+01:00',
    },
    {
      id: 'Asia/Kolkata',
      city: 'Kolkata',
      ianaCity: 'Kolkata',
      aliases: ['Calcutta'],
      formerName: 'Calcutta',
      country: 'India',
      offset: '+05:30',
    },
    {
      id: 'America/Argentina/Buenos_Aires',
      city: 'Buenos Aires',
      ianaCity: 'Buenos Aires',
      aliases: [],
      formerName: null,
      country: 'Argentina',
      offset: '-03:00',
    },
    {
      id: 'America/St_Johns',
      city: 'St. John’s',
      ianaCity: 'St Johns',
      aliases: ['Newfoundland'],
      formerName: null,
      country: 'Canada',
      offset: '-02:30',
    },
    {
      id: 'Asia/Ho_Chi_Minh',
      city: 'Ho Chi Minh City',
      ianaCity: 'Ho Chi Minh',
      aliases: ['Saigon'],
      formerName: 'Saigon',
      country: 'Vietnam',
      offset: '+07:00',
    },
    {
      id: 'Europe/Kyiv',
      city: 'Kyiv',
      ianaCity: 'Kyiv',
      aliases: ['Kiev', 'Simferopol', 'Uzhgorod', 'Zaporozhye'],
      formerName: 'Kiev',
      country: 'Ukraine',
      offset: '+03:00',
    },
    {
      id: 'America/Sao_Paulo',
      city: 'São Paulo',
      ianaCity: 'Sao Paulo',
      aliases: ['East'],
      formerName: null,
      country: 'Brazil',
      offset: '-03:00',
    },
    {
      id: 'America/New_York',
      city: 'New York',
      ianaCity: 'New York',
      aliases: ['Eastern'],
      formerName: null,
      country: 'United States',
      offset: '-04:00',
    },
  ];
  const ids = (query: string) => matchingZones(LOCAL, query).map((z) => z.id);

  it('finds a city by its local name and by IANA’s, accents ignored', () => {
    expect(ids('londres')).toEqual(['Europe/London']);
    expect(ids('London')).toEqual(['Europe/London']);
    expect(ids('st john')).toEqual(['America/St_Johns']);
    expect(ids('St Johns')).toEqual(['America/St_Johns']);
    expect(ids("st. john's")).toEqual(['America/St_Johns']);
    expect(exactZone(LOCAL, "St. John's")?.id).toBe('America/St_Johns');
    expect(
      matchingZones([{ ...LOCAL[3]!, city: 'Saint-Jean de Terre-Neuve' }], 'saint jean'),
    ).toHaveLength(1);
  });

  it('finds a zone by a former name, and says which', () => {
    expect(ids('Calcutta')).toEqual(['Asia/Kolkata']);
    expect(formerName(LOCAL[1]!, 'calcutta')).toBe('Calcutta');
    expect(ids('saigon')).toEqual(['Asia/Ho_Chi_Minh']);
    expect(formerName(LOCAL[4]!, 'saigon')).toBe('Saigon');
    expect(formerName(LOCAL[5]!, 'kiev')).toBe('Kiev');
  });

  it('finds a zone by any other link, and never calls that link its former name', () => {
    const found = (query: string) =>
      matchingZones(LOCAL, query).map((zone) => [zone.id, formerName(zone, query)]);

    expect(found('zaporozhye')).toEqual([['Europe/Kyiv', null]]);
    expect(found('uzhgorod')).toEqual([['Europe/Kyiv', null]]);
    expect(found('east')).toEqual([
      ['America/Sao_Paulo', null],
      ['America/New_York', null],
    ]);
    expect(found('eastern')).toEqual([['America/New_York', null]]);
    expect(found('gb')).toEqual([['Europe/London', null]]);
  });

  it('shows no former name when the row’s own name, country or offset matched', () => {
    expect(formerName(LOCAL[2]!, 'Buenos Aires')).toBeNull();
    expect(formerName(LOCAL[1]!, 'india')).toBeNull();
    expect(formerName(LOCAL[1]!, 'utc+5:30')).toBeNull();
    expect(ids('utc+5:30')).toEqual(['Asia/Kolkata']);
  });

  it('saves a typed city in either spelling, never a typed former name', () => {
    expect(exactZone(LOCAL, 'london')?.id).toBe('Europe/London');
    expect(exactZone(LOCAL, 'Londres')?.id).toBe('Europe/London');
    expect(exactZone(LOCAL, 'Calcutta')).toBeNull();
  });
});

describe("the account's zone on its card", () => {
  it('names a listed zone, with its id under the name', () => {
    expect(zoneValue('Africa/Lagos', ZONES)).toEqual({
      kind: 'shown',
      name: 'Lagos (UTC+01:00)',
      id: 'Africa/Lagos',
    });
  });

  it('waits for the list rather than showing the id as the name', () => {
    expect(zoneValue('Asia/Kolkata', null)).toEqual({ kind: 'waiting' });
  });

  it('never waits with no zone set', () => {
    expect(zoneValue(null, null)).toEqual({ kind: 'unset' });
  });

  it("takes IANA's city when the list has no row for the zone, or never came", () => {
    expect(zoneValue('Asia/Calcutta', ZONES)).toEqual({
      kind: 'shown',
      name: 'Calcutta',
      id: 'Asia/Calcutta',
    });
    expect(zoneValue('America/Argentina/Buenos_Aires', [])).toEqual({
      kind: 'shown',
      name: 'Buenos Aires',
      id: 'America/Argentina/Buenos Aires',
    });
  });

  it('shows an id with no slash once', () => {
    expect(zoneValue('UTC', [])).toEqual({ kind: 'shown', name: 'UTC', id: null });
  });
});
