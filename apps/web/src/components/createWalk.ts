import { ApiError, type Membership } from '@soirely/api-client';
import {
  type NewOrganisationField,
  countryChoices,
  currencyLabel,
  formatTimeOfDay,
  lockLiftsAt,
  newOrganisationProblem,
  timezoneLabel,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

export type Step = 1 | 2 | 3;
export const STEPS = 3;
export type Answer = 'limited' | 'failed';
/** Where focus lands as a state opens: `option` is the pick's row, in the device's group unless `inList`. */
export type Landing = 'field' | 'question' | 'option' | 'search' | 'create' | 'dialog';

export interface Device {
  country: string | null;
  zone: string;
}

/** The currency each country founds with, by its code, as the API's `Regions::currencyOf` says it: null where there is none. */
export type Currencies = ReadonlyMap<string, string | null>;

export interface Country {
  code: string;
  name: string;
  /** Its currency's words, `none` for a country with no money of its own; null while the currencies are not yet read. */
  currency: { words: string; none: boolean } | null;
}

export interface Walk {
  step: Step;
  name: string;
  device: Device;
  country: string | null;
  query: string;
  nameRefused: string | null;
  countryRefused: string | null;
  answer: Answer | null;
  lifts: Date | null;
  creating: boolean;
  asking: boolean;
  landing: Landing;
  inList: boolean;
  /** An account its home organisation manages (sc-563): the refusal in the first step's place. */
  managed: boolean;
}

export type WalkAnswer<Made> =
  | { kind: 'created'; made: Made }
  | { kind: 'refused'; errors: Partial<Record<NewOrganisationField, string>> }
  | { kind: 'limited'; until: Date | null }
  | { kind: 'failed' };

export const NAME_SHRINKS_FROM = 40;

export function freshWalk(device: Device): Walk {
  return {
    step: 1,
    name: '',
    device,
    country: device.country,
    query: '',
    nameRefused: null,
    countryRefused: null,
    answer: null,
    lifts: null,
    creating: false,
    asking: false,
    landing: 'field',
    inList: false,
    managed: false,
  };
}

export function countriesOf(
  locale: string,
  currencies: Currencies | null,
  t: TFunction,
): readonly Country[] {
  return countryChoices(locale).map(({ code, name }) => {
    if (currencies == null || !currencies.has(code)) return { code, name, currency: null };
    const currency = currencies.get(code) ?? null;

    return {
      code,
      name,
      currency:
        currency == null
          ? { words: t('createOrganisation.noneYet'), none: true }
          : { words: currencyLabel(currency, locale), none: false },
    };
  });
}

export function optionLabel(country: Country): string {
  return country.currency == null ? country.name : `${country.name}, ${country.currency.words}`;
}

export function narrowed(
  countries: readonly Country[],
  query: string,
  locale: string,
): readonly Country[] {
  const needle = query.trim().toLocaleLowerCase(locale);

  return needle === ''
    ? countries
    : countries.filter((country) => country.name.toLocaleLowerCase(locale).includes(needle));
}

export function nameRefusal(name: string, t: TFunction): string | null {
  const problem = newOrganisationProblem('name', name);

  if (problem == null) return null;
  if (problem.kind === 'nameLong')
    return t('createOrganisation.nameLong', { length: problem.length });

  return t('orgGeneral.nameBlank');
}

function countryRefusal(country: string | null, t: TFunction): string | null {
  return newOrganisationProblem('countryCode', country ?? '') == null
    ? null
    : t('forms.countryBlank');
}

export function entered(walk: Walk): boolean {
  return walk.name.trim() !== '' || walk.country !== walk.device.country;
}

export function shrinks(name: string): boolean {
  return Array.from(name.trim()).length >= NAME_SHRINKS_FROM;
}

/** Continue checks only its own step; null means it may go on. */
export function stepRefused(
  walk: Walk,
  t: TFunction,
): Pick<Walk, 'nameRefused' | 'countryRefused'> | null {
  if (walk.step === 1) {
    const refused = nameRefusal(walk.name, t);

    return refused == null ? null : { nameRefused: refused, countryRefused: null };
  }
  if (walk.step === 2) {
    const refused = countryRefusal(walk.country, t);

    return refused == null ? null : { nameRefused: null, countryRefused: refused };
  }

  return null;
}

/** The walk after an answer other than created: a refused field takes it back to that field's step, with the server's reason. */
export function answered(
  walk: Walk,
  answer: Exclude<WalkAnswer<unknown>, { kind: 'created' }>,
): Walk {
  const settled = { ...walk, creating: false };
  if (answer.kind === 'limited')
    return { ...settled, answer: 'limited', lifts: answer.until, landing: 'create' };
  if (answer.kind === 'failed') return { ...settled, answer: 'failed', landing: 'create' };

  const name = answer.errors.name ?? null;

  return {
    ...settled,
    step: name != null ? 1 : 2,
    answer: null,
    query: '',
    nameRefused: name,
    countryRefused: name == null ? (answer.errors.countryCode ?? null) : null,
    inList: true,
    landing: name != null ? 'field' : 'search',
  };
}

export function limitedLine(walk: Walk, locale: string, t: TFunction): string | null {
  return walk.lifts == null
    ? null
    : t('createOrganisation.limitedBody', { time: formatTimeOfDay(walk.lifts, locale) });
}

function lowered(words: string, locale: string): string {
  return words.charAt(0).toLocaleLowerCase(locale) + words.slice(1);
}

export function pickLine(country: Country, walk: Walk, locale: string, t: TFunction): string {
  const zone = `${t('orgGeneral.timezone')}, ${lowered(t('createOrganisation.fromDevice'), locale)}, ${timezoneLabel(walk.device.zone)}.`;

  return country.currency == null
    ? zone
    : `${t('orgGeneral.currency')}, ${country.currency.words}. ${zone}`;
}

export function cardLine(
  walk: Walk,
  countries: readonly Country[],
  email: string,
  t: TFunction,
): string {
  const country = countries.find((one) => one.code === walk.country);
  const facts =
    country == null
      ? []
      : [
          `${t('createOrganisation.country')}, ${country.name}.`,
          ...(country.currency == null
            ? []
            : [`${t('orgGeneral.currency')}, ${country.currency.words}.`]),
          `${t('orgGeneral.timezone')}, ${timezoneLabel(walk.device.zone)}.`,
          `${t('orgGeneral.contact')}, ${email}.`,
        ];

  return [
    `${walk.name.trim()}.`,
    `${t('switcher.yourRole', { role: t('roles.owner') })}.`,
    ...facts,
  ].join(' ');
}

const FIELDS: readonly NewOrganisationField[] = ['name', 'countryCode'];

/** sc-390's Create an organisation as the server answers it, in the walk's shape. */
export async function createOrganisation(
  create: (organisation: {
    name: string;
    countryCode: string;
    timezone: string;
  }) => Promise<Membership>,
  walk: Walk,
): Promise<WalkAnswer<Membership>> {
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
    if (error instanceof ApiError && error.is('too_many_attempts'))
      return {
        kind: 'limited',
        until: lockLiftsAt(Number(error.response?.headers.get('Retry-After'))),
      };

    if (error instanceof ApiError && error.is('validation_failed')) {
      const named = error.fieldErrors();
      const errors: Partial<Record<NewOrganisationField, string>> = {};
      for (const field of FIELDS) {
        const reason = named[field];
        if (reason != null) errors[field] = reason;
      }

      // A refusal naming only a field the walk lacks, such as the derived contact address.
      return Object.keys(errors).length === 0 ? { kind: 'failed' } : { kind: 'refused', errors };
    }

    return { kind: 'failed' };
  }
}
