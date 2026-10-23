import { currencyChoices as offeredCurrencies, timezoneLabel, withCurrent } from '@soirely/domain';
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

export function timeZoneChoices(current: string): Choice[] {
  return withCurrent(Intl.supportedValuesOf('timeZone'), current).map((zone) => ({
    value: zone,
    label: timezoneLabel(zone),
  }));
}
