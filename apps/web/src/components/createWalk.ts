import { ApiError } from '@soirely/api-client';
import {
  type FoundingCurrencies,
  type FoundingCurrencyWords,
  type NewOrganisation,
  type NewOrganisationAnswer,
  countryChoices,
  createNewOrganisation,
  foundingCurrencyWords,
  newOrganisationEntered,
  newOrganisationLimit,
  newOrganisationRefusal,
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

export type Currencies = FoundingCurrencies;

export interface Country {
  code: string;
  name: string;
  /** Null while the currencies are not yet read. */
  currency: FoundingCurrencyWords | null;
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
}

export type WalkAnswer<Made> = NewOrganisationAnswer<Made>;

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
  };
}

/** The countries the API founds in, once it has said which, and every one the reader's language names until then. */
export function countriesOf(
  locale: string,
  currencies: Currencies | null,
  t: TFunction,
): readonly Country[] {
  return countryChoices(locale)
    .filter(({ code }) => currencies == null || currencies.has(code))
    .map(({ code, name }) => ({
      code,
      name,
      currency: foundingCurrencyWords(code, currencies, locale, t),
    }));
}

export function optionLabel(country: Country): string {
  return country.currency == null ? country.name : `${country.name}, ${country.currency.words}`;
}

export function entered(walk: Walk): boolean {
  return newOrganisationEntered(walk, walk.device.country);
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
    const refused = newOrganisationRefusal('name', walk.name, t);

    return refused == null ? null : { nameRefused: refused, countryRefused: null };
  }
  if (walk.step === 2) {
    const refused = newOrganisationRefusal('countryCode', walk.country ?? '', t);

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
  return newOrganisationLimit(walk.lifts, locale, t).body;
}

export function pickLine(country: Country, walk: Walk, t: TFunction): string {
  const zone = timezoneLabel(walk.device.zone);

  return country.currency == null
    ? t('createOrganisation.pickedZone', { zone })
    : t('createOrganisation.picked', { currency: country.currency.words, zone });
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

/** sc-390's Create an organisation as the server answers it, in the walk's shape. */
export function createOrganisation<Made>(
  create: (organisation: NewOrganisation) => Promise<Made>,
  walk: Walk,
): Promise<WalkAnswer<Made>> {
  return createNewOrganisation(
    create,
    { name: walk.name, countryCode: walk.country ?? '', timezone: walk.device.zone },
    (error) => (error instanceof ApiError ? error : null),
  );
}
