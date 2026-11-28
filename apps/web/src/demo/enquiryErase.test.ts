import { describe, expect, it } from 'vitest';

import { ENQUIRIES } from './enquiries.ts';
import {
  ERASED_WEDDING,
  QUIET,
  erasedTitle,
  mayDelete,
  monthWords,
  warnsOn,
} from './enquiryErase.ts';
import { SAMPLE } from './consultations.ts';
import { PEOPLE } from './enquiries.ts';

const typeWord = (type: string) => (type === 'wedding' ? 'Wedding' : type);
const month = ERASED_WEDDING.erased!;

describe('an erased row’s title (sc-31235)', () => {
  it.each([
    [ERASED_WEDDING, 'Erased enquiry · Wedding · June 2027'],
    [{ ...ERASED_WEDDING, type: null }, 'Erased enquiry · June 2027'],
    [{ ...ERASED_WEDDING, erased: { ...month, month: null } }, 'Erased enquiry · Wedding'],
    [{ ...ERASED_WEDDING, type: null, erased: { ...month, month: null } }, 'Erased enquiry'],
  ])('leaves out a part it never had, with its separator', (enquiry, title) => {
    expect(erasedTitle(enquiry, typeWord, 'en-US')).toBe(title);
  });

  it.each([
    ['es', 'junio de 2027'],
    ['fr', 'juin 2027'],
    ['pt', 'junho de 2027'],
  ])('says the month and year in %s', (locale, said) => {
    expect(monthWords('2027-06', locale)).toBe(said);
  });
});

describe('the 30-day warning (sc-31235)', () => {
  it('warns an Open enquiry inside its last 30 days', () => {
    expect(warnsOn(QUIET, null, '2026-11-18T10:00:00Z')).toBe('2026-12-04');
  });

  it('says nothing more than 30 days ahead', () => {
    expect(warnsOn(QUIET, null, '2026-11-01T10:00:00Z')).toBeNull();
  });

  it('never warns a Lost enquiry', () => {
    expect(warnsOn({ ...QUIET, tab: 'lost' }, null)).toBeNull();
  });

  it('never warns one with a consultation still to come', () => {
    expect(warnsOn(QUIET, SAMPLE.later)).toBeNull();
  });

  it('leaves the sample’s recent enquiries alone', () => {
    expect(ENQUIRIES.map((one) => warnsOn(one, null)).filter((day) => day != null)).toEqual([]);
  });
});

describe('who may delete (sc-31235)', () => {
  it('lets an Owner and an Admin delete any enquiry not Won, erased included', () => {
    expect(mayDelete(QUIET, PEOPLE.folake)).toBe(true);
    expect(mayDelete(ERASED_WEDDING, PEOPLE.kemi)).toBe(true);
  });

  it('refuses a Member, and a Won enquiry', () => {
    expect(mayDelete(QUIET, PEOPLE.tunde)).toBe(false);
    expect(mayDelete({ ...QUIET, tab: 'won' }, PEOPLE.folake)).toBe(false);
  });
});
