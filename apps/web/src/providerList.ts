import { listFormat } from '@soirely/domain';

import { currentLocale } from './i18n/index.ts';

const PROVIDER_NAMES: Record<string, string> = { google: 'Google', apple: 'Apple' };

/** "Google or Apple", in the reader's language; the names are the providers' own. */
export function providerList(providers: readonly string[]): string {
  const names = (providers.length > 0 ? providers : ['google', 'apple']).map(
    (provider) => PROVIDER_NAMES[provider] ?? provider,
  );

  return listFormat(currentLocale(), { type: 'disjunction' }).format(names);
}
