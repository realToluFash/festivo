import { currencyLabel, timezoneLabel, withCurrent } from '@soirely/domain';

export interface Choice {
  value: string;
  label: string;
}

/** The lists Settings > General offers, so an event starts from the same ones. */
export function currencyChoices(current: string, locale: string): Choice[] {
  return withCurrent(Intl.supportedValuesOf('currency'), current).map((code) => ({
    value: code,
    label: currencyLabel(code, locale),
  }));
}

export function timeZoneChoices(current: string): Choice[] {
  return withCurrent(Intl.supportedValuesOf('timeZone'), current).map((zone) => ({
    value: zone,
    label: timezoneLabel(zone),
  }));
}
