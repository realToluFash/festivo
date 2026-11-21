/** sc-80918: the credit OpenStreetMap's licence asks for wherever its data shows, at the foot of the address suggestions and nowhere else. */
export const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';

export type CreditLanguage = 'en' | 'fr';

/** "OpenStreetMap" is never translated; the linguist words the rest in es, fr and pt. */
export const OSM_CREDIT: Record<CreditLanguage, string> = {
  en: '© OpenStreetMap contributors',
  fr: '© les contributeurs d’OpenStreetMap',
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
