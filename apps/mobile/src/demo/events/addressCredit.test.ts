import { describe, expect, it } from 'vitest';

import {
  CREDIT_TYPED,
  OSM_COPYRIGHT,
  OSM_CREDIT,
  creditLanguageOf,
  isCreditState,
} from './addressCredit.ts';
import { folded } from './EventsModel.ts';
import { SUGGESTIONS } from './EventsSample.ts';

function found(typed: string) {
  return folded(typed).length < 3
    ? []
    : SUGGESTIONS.filter((one) => folded(one.name).includes(folded(typed)));
}

describe('the OpenStreetMap credit (sc-80918)', () => {
  it('keeps OpenStreetMap as written and links to its copyright page', () => {
    for (const words of Object.values(OSM_CREDIT)) expect(words).toMatch(/^© .*OpenStreetMap/);
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
