/** A phone code refused after the right code, as sc-69 refuses a password (sc-94849): the 403 `oauth_only`'s organisation and providers. */
export type Provider = 'google' | 'apple';

export const PROVIDER_ORG = 'Ìrè Events';

const NAMES: Record<Provider, string> = { google: 'Google', apple: 'Apple' };

/** The accounts the three states draw: Google linked, Apple linked, both (the API lists them by provider, Google first). */
export const LINKED = {
  google: ['google'],
  apple: ['apple'],
  both: ['google', 'apple'],
} as const satisfies Record<string, readonly Provider[]>;

/** The linked providers a provider-only state draws: `-apple` Apple, `-both` both, else Google. */
export function linkedIn(state: string): readonly Provider[] {
  if (state.endsWith('-apple')) return LINKED.apple;

  return state.endsWith('-both') ? LINKED.both : LINKED.google;
}

export const providerOnlyTitle = (organisation: string) =>
  `${organisation} signs in with Google or Apple only`;

/** "Google", "Apple", or both joined as the locale joins a choice; English joins two with "or". */
export const providerNames = (providers: readonly Provider[]) =>
  providers.map((one) => NAMES[one]).join(' or ');

/** [en]'s line (#94892 on sc-94849): no password in it, which they never typed. */
export const providerOnlyLine = (organisation: string, providers: readonly Provider[]) =>
  `A code sent to your phone cannot sign you in to this account. ${organisation} asks everyone in it to use ${providerNames(providers)}.`;

export const continueWith = (provider: Provider) => `Continue with ${NAMES[provider]}`;
