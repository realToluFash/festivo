import { describe, expect, it } from 'vitest';

import { LANGUAGE_STATES, languageStart } from './languageSheetModel.ts';

describe('the Language sheet demo (sc-77159)', () => {
  it('opens each state as its board draws it', () => {
    expect(languageStart('language')).toEqual({ open: true, locale: 'en', doneUnder: false });
    expect(languageStart('languageFr')).toEqual({ open: true, locale: 'fr', doneUnder: false });
    expect(languageStart('languageFrUnder')).toEqual({ open: true, locale: 'fr', doneUnder: true });
    expect(languageStart(undefined)).toEqual({ open: false, locale: null, doneUnder: false });
    expect(LANGUAGE_STATES).toHaveLength(3);
  });
});
