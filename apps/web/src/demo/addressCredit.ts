/** sc-80918: the credit Stadia's terms (§8) and OpenStreetMap's licence (ODbL §4.3) ask for wherever their data shows, at the foot of the address suggestions and nowhere else. */
export const STADIA_ATTRIBUTION = 'https://stadiamaps.com/attribution/';
export const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';

export type CreditLanguage = 'en' | 'fr';

/** "©", "Stadia Maps" and "OpenStreetMap" are never translated; the linguist words the rest in es, fr and pt. Each part is one link. */
export const OSM_CREDIT: Record<CreditLanguage, { stadia: string; osm: string }> = {
  en: { stadia: 'Stadia Maps', osm: 'OpenStreetMap contributors' },
  fr: { stadia: 'Stadia Maps', osm: 'les contributeurs d’OpenStreetMap' },
};

/** What each credit state has typed into Address. */
export const CREDIT_TYPED = {
  venueOne: 'Signature',
  venueShort: 'Ek',
  venueNoMatch: 'Rue de Rivoli',
  venueFrench: 'Eko',
} as const;

export type CreditState = keyof typeof CREDIT_TYPED;

export function isCreditState(state: string | null): state is CreditState {
  return state != null && state in CREDIT_TYPED;
}

export function creditLanguageOf(state: string | null): CreditLanguage {
  return state === 'venueFrench' ? 'fr' : 'en';
}
