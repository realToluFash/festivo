import {
  CURRENCY_CODES,
  currencyChoices as offeredCurrencies,
  timezoneLabel,
  withCurrent,
} from '@soirely/domain';
import { type TFunction } from 'i18next';

export interface Choice {
  value: string;
  label: string;
}

/** The lists Settings > General offers, so an event starts from the same ones; an empty field offers its placeholder until something is chosen. */
export function currencyChoices(
  held: string,
  chosen: string,
  locale: string,
  t: TFunction,
): Choice[] {
  const offered = offeredCurrencies(held, locale, (code) =>
    t('orgGeneral.currencyRetired', { code }),
  ).map(({ code, name }) => ({ value: code, label: name }));

  return chosen === ''
    ? [{ value: '', label: t('orgGeneral.currencyPlaceholder') }, ...offered]
    : offered;
}

/** The same set by code, A to Z, for a field that shows codes; a held code no longer offered stays first under its retired label. */
export function currencyCodeChoices(
  held: string,
  chosen: string,
  locale: string,
  t: TFunction,
): Choice[] {
  const choices = currencyChoices(held, chosen, locale, t);
  const kept = choices.filter((one) => !CURRENCY_CODES.includes(one.value));
  const offered = choices
    .filter((one) => CURRENCY_CODES.includes(one.value))
    .map(({ value }) => ({ value, label: value }))
    .sort((a, b) => (a.value < b.value ? -1 : 1));

  return [...kept, ...offered];
}

/** Every zone the browser knows, and each held one it does not, such as a venue's in the spelling the API gave it. */
export function timeZoneChoices(...held: string[]): Choice[] {
  return held.reduce(withCurrent, Intl.supportedValuesOf('timeZone')).map((zone) => ({
    value: zone,
    label: timezoneLabel(zone),
  }));
}
