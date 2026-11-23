import { describe, expect, it } from 'vitest';

import { OSM_COPYRIGHT, STADIA_ATTRIBUTION } from '@soirely/domain';

import { CREDIT_TYPED, FRENCH_CREDIT, creditLanguageOf, isCreditState } from './addressCredit.ts';
import { suggestionsFor } from './events.ts';

describe('the Stadia Maps and OpenStreetMap credit (sc-80918)', () => {
  it('keeps Stadia Maps and OpenStreetMap as written in every language', () => {
    expect(FRENCH_CREDIT).toMatch(/OpenStreetMap/);
  });

  it('links to Stadia’s attribution page and OpenStreetMap’s copyright page', () => {
    expect(STADIA_ATTRIBUTION).toBe('https://stadiamaps.com/attribution/');
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
