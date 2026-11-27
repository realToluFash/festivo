import type { StaffEntry } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { copies, offersMark, withShifts } from './staffBriefing.ts';

const person = (over: Partial<StaffEntry>): StaffEntry =>
  ({
    id: 'a',
    fullName: 'A',
    mobile: '+4915112345678',
    shifts: [
      { id: 's', startsAt: '2026-11-01T18:00:00+01:00', endsAt: '2026-11-01T23:00:00+01:00' },
    ],
    briefing: 'none',
    briefingCopy: null,
    contactsErased: false,
    ...over,
  }) as StaffEntry;

describe('who can be copied for', () => {
  it('lists only people with a shift', () => {
    const idle = person({ id: 'b', shifts: [] });
    expect(withShifts([person({}), idle]).map((one) => one.id)).toEqual(['a']);
  });

  it('needs staff.manage, a mobile number and contacts not erased', () => {
    expect(copies(person({}), true)).toBe(true);
    expect(copies(person({}), false)).toBe(false);
    expect(copies(person({ mobile: null }), true)).toBe(false);
    expect(copies(person({ contactsErased: true }), true)).toBe(false);
  });

  it('offers Mark as sent only after a copy not yet marked', () => {
    expect(offersMark(person({}))).toBe(false);
    expect(offersMark(person({ briefingCopy: { by: 'K', at: 'x', marked: false } }))).toBe(true);
    expect(offersMark(person({ briefingCopy: { by: 'K', at: 'x', marked: true } }))).toBe(false);
  });
});
