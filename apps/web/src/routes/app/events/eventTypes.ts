import { EVENT_TYPES, type EventType } from '@soirely/domain';
import { type TFunction } from 'i18next';

import { type Choice } from '../../../zoneAndCurrencyChoices.ts';

export function typeLabel(type: EventType, t: TFunction): string {
  return t(`eventTypes.${type}`);
}

/** The placeholder is offered only while nothing is chosen, so a typed event cannot go back to none (sc-3588). */
export function typeChoices(chosen: EventType | '', t: TFunction): Choice[] {
  const offered = EVENT_TYPES.map((type) => ({ value: type, label: typeLabel(type, t) }));

  return chosen === ''
    ? [{ value: '', label: t('eventForm.typePlaceholder') }, ...offered]
    : offered;
}
