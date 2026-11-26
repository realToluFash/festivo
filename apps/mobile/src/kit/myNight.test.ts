import type { MyNight } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { clockOpensAt, crossesMidnight, dietaryOf, headingOf, rowLineOf } from './myNight.ts';

const t = ((key: string, values?: Record<string, unknown>) =>
  key === 'myNight.times'
    ? `${String(values?.start)} to ${String(values?.end)}`
    : key === 'myNight.otherNeed'
      ? `${String(values?.what)} (other)`
      : key) as unknown as TFunction;

const NIGHT: MyNight = {
  event: { name: 'Adébáyọ̀ at 60', timeZone: 'Africa/Lagos' },
  endsAt: '2026-11-29T02:00:00+01:00',
  station: 'Section B',
  job: 'Waiter',
  shift: {
    job: 'Waiter',
    startsAt: '2026-11-28T17:00:00+01:00',
    endsAt: '2026-11-29T01:00:00+01:00',
  },
  later: null,
  lead: null,
  timing: [],
  doorsAt: '2026-11-28T19:00:00+01:00',
  tables: null,
};

describe('a staff member’s night in the app (sc-3915)', () => {
  it('names where they are and the shift on the event’s Your night row, the job with no station', () => {
    expect(rowLineOf(t, NIGHT, 'en-GB')).toBe('Section B · 17:00 to 01:00');
    expect(rowLineOf(t, { ...NIGHT, station: null }, 'en-GB')).toBe('Waiter · 17:00 to 01:00');
  });

  it('shows no row without a shift', () => {
    expect(rowLineOf(t, { ...NIGHT, shift: null }, 'en-GB')).toBeNull();
  });

  it('heads with the station, else the job', () => {
    expect(headingOf(NIGHT)).toBe('Section B');
    expect(headingOf({ ...NIGHT, station: null })).toBe('Waiter');
  });

  it('opens the clock an hour before the shift, and shows no card from then', () => {
    expect(clockOpensAt(NIGHT, new Date('2026-11-28T14:30:00Z'))).toBe('2026-11-28T15:00:00.000Z');
    expect(clockOpensAt(NIGHT, new Date('2026-11-28T15:00:00Z'))).toBeNull();
  });

  it('knows a shift that ends after midnight on the event’s clock', () => {
    expect(crossesMidnight(NIGHT.shift!)).toBe(true);
    expect(
      crossesMidnight({ startsAt: NIGHT.shift!.startsAt, endsAt: '2026-11-28T23:00:00+01:00' }),
    ).toBe(false);
  });

  it('names diets, then allergies, with what the guest wrote for other', () => {
    const guest = {
      name: 'Amara Eze',
      diets: ['vegetarian'],
      allergens: ['other'],
      otherAllergy: 'Kiwi',
      otherDiet: null,
    };

    expect(dietaryOf(t, guest)).toBe('guestNeeds.dietName.vegetarian, Kiwi (other)');
    expect(dietaryOf(t, { ...guest, diets: [], allergens: [] })).toBeNull();
  });
});
