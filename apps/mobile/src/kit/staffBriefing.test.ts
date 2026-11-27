import type { StaffEntry } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { codePoints, copies, fitRules, offersMark, tallyOf, withShifts } from './staffBriefing.ts';

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

describe('codePoints', () => {
  it('counts "Ọ̀" as two', () => {
    expect(codePoints('Ọ̀')).toBe(2);
  });
});

describe('fitRules', () => {
  it('keeps the first 2,000 code points of a paste that goes over, and says it cut', () => {
    const typed = 'a'.repeat(1990) + 'Ọ̀'.repeat(6);
    expect(codePoints(typed)).toBe(2002);
    const fitted = fitRules('a'.repeat(1990), typed);
    expect(fitted.cut).toBe(true);
    expect(codePoints(fitted.text)).toBe(2000);
  });

  it('keeps 2,001 pasted code points to 2,000', () => {
    const fitted = fitRules('', 'b'.repeat(2001));
    expect(fitted).toEqual({ text: 'b'.repeat(2000), cut: true });
  });

  it('does not take a key typed at the limit, and does not call it a cut', () => {
    const full = 'c'.repeat(2000);
    expect(fitRules(full, `${full}d`)).toEqual({ text: full, cut: false });
  });

  it('leaves text within the limit as typed', () => {
    expect(fitRules('ab', 'abc')).toEqual({ text: 'abc', cut: false });
  });
});

describe('tallyOf', () => {
  it('counts each of the four states from the rows', () => {
    const people = [
      person({ briefing: 'read' }),
      person({ briefing: 'sent' }),
      person({ briefing: 'sent' }),
      person({ briefing: 'changed' }),
      person({ briefing: 'none' }),
    ];
    expect(tallyOf(people)).toEqual({ read: 1, sent: 2, changed: 1, none: 1 });
  });
});

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
