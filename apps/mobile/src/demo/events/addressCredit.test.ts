import { describe, expect, it } from 'vitest';

import {
  CREDIT_TYPED,
  OSM_COPYRIGHT,
  OSM_CREDIT,
  STADIA_ATTRIBUTION,
  creditLanguageOf,
  isCreditState,
} from './addressCredit.ts';
import { suggestionsFor as found } from './EventsModel.ts';

describe('the Stadia Maps and OpenStreetMap credit (sc-80918)', () => {
  it('keeps Stadia Maps and OpenStreetMap as written, each linking to its own page', () => {
    for (const words of Object.values(OSM_CREDIT)) {
      expect(words.stadia).toBe('Stadia Maps');
      expect(words.osm).toMatch(/OpenStreetMap/);
    }
    expect(STADIA_ATTRIBUTION).toBe('https://stadiamaps.com/attribution/');
    expect(OSM_COPYRIGHT).toBe('https://www.openstreetmap.org/copyright');
  });

  it('types what each state needs into Address', () => {
    expect(found(CREDIT_TYPED.venueOne)).toHaveLength(1);
    expect(found(CREDIT_TYPED.venueShort)).toHaveLength(0);
    expect(found(CREDIT_TYPED.venueNoMatch)).toHaveLength(0);
    expect(found(CREDIT_TYPED.venueFrench)).toHaveLength(3);
  });

  it('is French only in the French state', () => {
    expect(creditLanguageOf('venueFrench')).toBe('fr');
    expect(creditLanguageOf('venueSuggestions')).toBe('en');
    expect(isCreditState('venueNoMatch')).toBe(true);
    expect(isCreditState('venue')).toBe(false);
  });
});
