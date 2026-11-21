import { describe, expect, it } from 'vitest';

import {
  CREDIT_TYPED,
  OSM_COPYRIGHT,
  OSM_CREDIT,
  creditLanguageOf,
  isCreditState,
} from './addressCredit.ts';
import { suggestionsFor } from './events.ts';

describe('the OpenStreetMap credit (sc-80918)', () => {
  it('keeps OpenStreetMap as written in every language', () => {
    for (const words of Object.values(OSM_CREDIT)) {
      expect(words).toMatch(/^© .*OpenStreetMap/);
    }
  });

  it('links to OpenStreetMap’s copyright page', () => {
    expect(OSM_COPYRIGHT).toBe('https://www.openstreetmap.org/copyright');
  });

  it('types what each state needs into Address', () => {
    expect(suggestionsFor(CREDIT_TYPED.venueOne)).toHaveLength(1);
    expect(suggestionsFor(CREDIT_TYPED.venueShort)).toHaveLength(0);
    expect(suggestionsFor(CREDIT_TYPED.venueNoMatch)).toHaveLength(0);
    expect(suggestionsFor(CREDIT_TYPED.venueFrench)).toHaveLength(3);
  });

  it('is French only in the French state', () => {
    expect(creditLanguageOf('venueFrench')).toBe('fr');
    expect(creditLanguageOf('venueSuggestions')).toBe('en');
    expect(isCreditState('venueOne')).toBe(true);
    expect(isCreditState('venueSuggestions')).toBe(false);
  });
});
