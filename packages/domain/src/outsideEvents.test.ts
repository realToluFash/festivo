import { describe, expect, it } from 'vitest';

import { isUnderWay, outsideEventLine, outsideEventsInOrder } from './outsideEvents.ts';

const congress = {
  id: 'e1',
  organisationName: 'Associação de Congressos',
  startsAt: '2026-11-07T08:30:00+00:00',
  endsAt: '2026-11-07T19:00:00+00:00',
};
const wedding = {
  id: 'e2',
  organisationName: 'Lumen Feiras',
  startsAt: '2026-11-14T15:00:00+00:00',
  endsAt: '2026-11-14T23:30:00+00:00',
};
const gala = {
  id: 'e3',
  organisationName: 'Les Salons',
  startsAt: '2026-11-21T19:30:00+01:00',
  endsAt: '2026-11-22T01:00:00+01:00',
};
const cocktail = { ...gala, id: 'e4', endsAt: '2026-11-21T23:00:00+01:00' };
const now = new Date('2026-11-07T10:00:00Z');

describe('outsideEventsInOrder', () => {
  it('moves the events under way to the front and otherwise keeps the API order', () => {
    expect(outsideEventsInOrder([wedding, gala, congress], now).map((one) => one.id)).toEqual([
      'e1',
      'e2',
      'e3',
    ]);
  });

  it('keeps a tie on the same start as the API gave it, the grant made first first', () => {
    expect(outsideEventsInOrder([gala, cocktail], now).map((one) => one.id)).toEqual(['e3', 'e4']);
    expect(outsideEventsInOrder([cocktail, gala], now).map((one) => one.id)).toEqual(['e4', 'e3']);
  });
});

describe('isUnderWay', () => {
  it('is under way from its start until its end', () => {
    expect(isUnderWay(congress, new Date('2026-11-07T08:30:00Z'))).toBe(true);
    expect(isUnderWay(congress, new Date('2026-11-07T08:29:59Z'))).toBe(false);
    expect(isUnderWay(congress, new Date('2026-11-07T19:00:00Z'))).toBe(false);
  });
});

describe('outsideEventLine', () => {
  it('writes the date and start in the event’s own zone, in the reader’s locale', () => {
    expect(outsideEventLine(gala, 'en-GB')).toBe('Les Salons · Sat 21 Nov · 19:30');
    expect(outsideEventLine(gala, 'fr-FR')).toBe('Les Salons · sam. 21 nov. · 19:30');
  });
});
