import { ApiError } from '@soirely/api-client';

import { formatTimeOfDay, lockLiftsAt } from './datetime.ts';
import type { Translate } from './eventWords.ts';
import { type NewOrganisationField, newOrganisationProblem } from './organisations.ts';
import { currencyLabel } from './regions.ts';

export interface NewOrganisation {
  name: string;
  countryCode: string;
  timezone: string;
}

export type NewOrganisationAnswer<Made> =
  | { kind: 'created'; made: Made }
  | { kind: 'refused'; errors: Partial<Record<NewOrganisationField, string>> }
  | { kind: 'limited'; until: Date | null }
  | { kind: 'failed' };

/** The walk as both clients hold it: the name as typed, the country picked, and the device it started on. */
export interface NewOrganisationWalk {
  name: string;
  country: string | null;
  device: { country: string | null; zone: string };
}

const FIELDS: readonly NewOrganisationField[] = ['name', 'countryCode'];

/** Sends the walk's answers, the name trimmed and the device's timezone, and reads the server's answer in the walk's shape. */
export async function createNewOrganisation<Made>(
  create: (organisation: NewOrganisation) => Promise<Made>,
  walk: NewOrganisationWalk,
): Promise<NewOrganisationAnswer<Made>> {
  try {
    return {
      kind: 'created',
      made: await create({
        name: walk.name.trim(),
        countryCode: walk.country ?? '',
        timezone: walk.device.zone,
      }),
    };
  } catch (error) {
    const refusal = error instanceof ApiError ? error : null;
    if (refusal?.is('too_many_attempts'))
      return {
        kind: 'limited',
        until: lockLiftsAt(Number(refusal.response?.headers.get('Retry-After'))),
      };
    if (refusal == null || !refusal.is('validation_failed')) return { kind: 'failed' };

    const named = refusal.fieldErrors();
    const errors: Partial<Record<NewOrganisationField, string>> = {};
    for (const field of FIELDS) {
      const reason = named[field];
      if (reason != null) errors[field] = reason;
    }

    // A refusal naming only a field the walk lacks, such as the derived contact address.
    return Object.keys(errors).length === 0 ? { kind: 'failed' } : { kind: 'refused', errors };
  }
}

export function newOrganisationRefusal(
  field: NewOrganisationField,
  value: string,
  t: Translate,
): string | null {
  const problem = newOrganisationProblem(field, value);

  if (problem == null) return null;
  if (problem.kind === 'nameLong')
    return t('createOrganisation.nameLong', { length: problem.length });

  return problem.kind === 'nameBlank' ? t('orgGeneral.nameBlank') : t('forms.countryBlank');
}

/** "Too many new organisations for now." over "Try again at 14:35.", in the reader's own clock, and no second line when no time came. */
export function newOrganisationLimit(
  until: Date | null,
  locale: string,
  t: Translate,
): { title: string; body: string | null } {
  return {
    title: t('createOrganisation.limitedTitle'),
    body:
      until == null
        ? null
        : t('createOrganisation.limitedBody', { time: formatTimeOfDay(until, locale) }),
  };
}

/** Whether Cancel asks first: a name is typed, or the country is no longer the device's. */
export function newOrganisationEntered(walk: NewOrganisationWalk): boolean {
  return walk.name.trim() !== '' || walk.country !== walk.device.country;
}

/** The currency each country founds with, by its code, as the API's `Regions::currencyOf` says it: null where there is none. */
export type FoundingCurrencies = ReadonlyMap<string, string | null>;

export interface FoundingCurrencyWords {
  words: string;
  none: boolean;
}

/** "Euro (EUR)", or "None yet"; null while the currencies are not yet read. */
export function foundingCurrencyWords(
  country: string | null,
  currencies: FoundingCurrencies | null,
  locale: string,
  t: Translate,
): FoundingCurrencyWords | null {
  if (country == null || currencies == null || !currencies.has(country)) return null;
  const currency = currencies.get(country) ?? null;

  return currency == null
    ? { words: t('createOrganisation.noneYet'), none: true }
    : { words: currencyLabel(currency, locale), none: false };
}

/** The countries whose name includes the search, lowercased by the reader's language so "İ" and "i" meet as they do in it, with accents and the apostrophe's shape set aside. */
export function countrySearch<Country extends { name: string }>(
  countries: readonly Country[],
  query: string,
  locale: string,
): readonly Country[] {
  const needle = searchFold(query.trim(), locale);
  if (needle === '') return countries;

  return countries.filter((country) => searchFold(country.name, locale).includes(needle));
}

function searchFold(text: string, locale: string): string {
  return text.toLocaleLowerCase(locale).normalize('NFD').replace(/\p{M}/gu, '').replace(/’/g, "'");
}
