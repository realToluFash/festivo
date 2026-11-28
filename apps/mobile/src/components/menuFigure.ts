import type { i18n as I18n } from 'i18next';

/** A count as the shown language writes it, through the same formatter as a sentence's `{{count, number}}`. */
export function menuFigure(i18n: I18n, count: number): string {
  return i18n.services.formatter!.format(count, 'number', i18n.language, {});
}
