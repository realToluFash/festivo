import type { MyNight } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  checkInBackOf,
  checkInHrefOf,
  checkInOf,
  crossesMidnight,
  dietaryOf,
  headingOf,
  rowLineOf,
  scanHrefOf,
  updatedAfter,
  whosHereOf,
} from './myNight.ts';

const t = ((key: string, values?: Record<string, unknown>) =>
  key === 'myNight.times'
    ? `${String(values?.start)} to ${String(values?.end)}`
    : key === 'myNight.otherNeed'
      ? `${String(values?.what)} (other)`
      : key) as unknown as TFunction;

const NIGHT: MyNight = {
  pastAccess: false,
  clock: null,
  event: { id: 'ev-1', name: 'Adébáyọ̀ at 60', timeZone: 'Africa/Lagos' },
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
  checksIn: false,
  dishes: false,
  whosHere: false,
  rules: null,
};

describe('My night leads a lead to Who’s here (sc-3918)', () => {
  it('as the only button, primary, when nothing comes before it', () => {
    expect(whosHereOf({ ...NIGHT, whosHere: true }, null)).toEqual({ primary: true });
  });

  it('as a secondary button under Check-in or Open {station}', () => {
    expect(whosHereOf({ ...NIGHT, whosHere: true, checksIn: true }, null)).toEqual({
      primary: false,
    });
    expect(whosHereOf({ ...NIGHT, whosHere: true }, 'Pass')).toEqual({ primary: false });
  });

  it('nowhere for someone who leads nothing', () => {
    expect(whosHereOf(NIGHT, 'Pass')).toBeNull();
  });
});

describe('My night leads to check-in (sc-28230)', () => {
  it('to the event’s check-in for a job that checks guests in', () => {
    expect(checkInOf({ ...NIGHT, checksIn: true })).toEqual({
      pathname: '/events/[id]/check-in',
      params: { id: 'ev-1', from: 'night' },
    });
  });

  it('nowhere for a job that cannot', () => {
    expect(checkInOf(NIGHT)).toBeNull();
  });

  it('back to Your night when check-in was opened from it, else to the event’s Guests', () => {
    expect(checkInBackOf('ev-1', 'night')).toEqual({
      label: 'myNight.title',
      href: { pathname: '/events/[id]/my-night', params: { id: 'ev-1' } },
    });
    expect(checkInBackOf('ev-1', undefined)).toEqual({ label: 'checkIn.back', href: null });
  });

  it('keeps Your night across the scanner and on both of its ways back to check-in', () => {
    expect(scanHrefOf('ev-1', 'night')).toEqual({
      pathname: '/events/[id]/scan',
      params: { id: 'ev-1', from: 'night' },
    });
    expect(checkInHrefOf('ev-1', 'night', { focus: 'search', tap: '1' })).toEqual({
      pathname: '/events/[id]/check-in',
      params: { id: 'ev-1', focus: 'search', tap: '1', from: 'night' },
    });
    expect(checkInHrefOf('ev-1', 'night')).toEqual({
      pathname: '/events/[id]/check-in',
      params: { id: 'ev-1', from: 'night' },
    });
  });

  it('carries nothing when check-in was opened from the event’s Guests', () => {
    expect(scanHrefOf('ev-1', undefined)).toEqual({
      pathname: '/events/[id]/scan',
      params: { id: 'ev-1' },
    });
    expect(checkInHrefOf('ev-1', undefined, { focus: 'search', tap: '1' }).params).toEqual({
      id: 'ev-1',
      focus: 'search',
      tap: '1',
    });
  });
});

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

  it('announces a move to another station, keeps it while nothing moves, and drops it once a move leaves no station', () => {
    const onC = { ...NIGHT, station: 'Section C' };
    const jobOnly = { ...NIGHT, station: null, tables: null };

    expect(updatedAfter(null, null, NIGHT)).toBeNull();
    expect(updatedAfter(NIGHT, null, onC)).toBe('Section C');
    expect(updatedAfter(onC, 'Section C', onC)).toBe('Section C');
    expect(updatedAfter(onC, 'Section C', jobOnly)).toBeNull();
  });
});
