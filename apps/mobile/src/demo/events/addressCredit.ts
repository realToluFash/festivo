/** sc-80918: the demo's French credit, OpenStreetMap's own wording, until the linguist's French lands in the catalogue. */
export const FRENCH_CREDIT = 'les contributeurs d’OpenStreetMap';

export type CreditLanguage = 'en' | 'fr';

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
