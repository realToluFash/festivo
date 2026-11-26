import { listFormat } from '@soirely/domain';

import { currentLocale } from './i18n/index.ts';

const PROVIDER_NAMES: Record<string, string> = { google: 'Google', apple: 'Apple' };

/** "Google or Apple", in the reader's language, Google first whatever order the API lists them in, as the heading names them (sc-96668); the names are the providers' own. */
export function providerList(providers: readonly string[]): string {
  const names = [...(providers.length > 0 ? providers : ['google', 'apple'])]
    .sort((a, b) => Number(b === 'google') - Number(a === 'google'))
    .map((provider) => PROVIDER_NAMES[provider] ?? provider);

  return listFormat(currentLocale(), { type: 'disjunction' }).format(names);
}
