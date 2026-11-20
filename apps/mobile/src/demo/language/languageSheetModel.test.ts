import { describe, expect, it } from 'vitest';

import {
  LANGUAGE_STATES,
  doneGap,
  doneUnder,
  languageStart,
  lineInList,
} from './languageSheetModel.ts';

describe('the Language sheet at the largest text sizes (sc-77159)', () => {
  it('opens each state as its board draws it', () => {
    expect(languageStart('language')).toEqual({ open: true, locale: 'en', doneUnder: false });
    expect(languageStart('languageFr')).toEqual({ open: true, locale: 'fr', doneUnder: false });
    expect(languageStart('languageFrUnder')).toEqual({ open: true, locale: 'fr', doneUnder: true });
    expect(languageStart(undefined)).toEqual({ open: false, locale: null, doneUnder: false });
    expect(LANGUAGE_STATES).toHaveLength(3);
  });

  it('keeps the line beside Done below the eighth step and lists it from there', () => {
    expect(lineInList(1)).toBe(false);
    expect(lineInList(1.353)).toBe(false);
    expect(lineInList(1.786)).toBe(true);
    expect(lineInList(3.571)).toBe(true);
    expect(doneGap(1)).toBe(12);
    expect(doneGap(2.143)).toBe(10);
  });

  it('puts Done under the title only where the longest word, the gap and Done pass the row', () => {
    const at = { fontScale: 3.571, forced: false };

    expect(doneUnder({ ...at, room: 352, widest: 127, done: 139 })).toBe(false);
    expect(doneUnder({ ...at, room: 352, widest: 210, done: 139 })).toBe(true);
    expect(doneUnder({ ...at, room: 0, widest: 127, done: 139 })).toBe(false);
    expect(doneUnder({ ...at, room: 352, widest: 127, done: 139, forced: true })).toBe(true);
  });
});
