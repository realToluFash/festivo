import type { BudgetLine, ChargedLine, MarginFigures } from '@soirely/api-client';
import { type MoneyLanguage, numberFormat } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { amountOfMinor, lineState, minorMoney, minorOf, wholeMoney } from './budgetArea.ts';

export const MOST_MARKUP = 999.9;

const DECIMAL: Record<MoneyLanguage, string> = { en: '.', fr: ',', es: ',', pt: ',' };

export type MarkupProblem = 'negative' | 'number' | 'decimals' | 'high';

/** "20%", "12,5 %": a markup or a share as the language writes a percent (CLDR), one decimal at most. */
export function percentWords(value: string | number, locale: string, decimals = 0): string {
  return numberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: 1,
  }).format(Number(value) / 100);
}

/** A typed markup as the API takes it ("12.5"), or null when blank, which takes the choice away (pm, 19 Nov). */
export function sentMarkup(typed: string, language: MoneyLanguage): string | null {
  const text = typed.trim();

  return text === '' ? null : text.replace(DECIMAL[language], '.');
}

/** Refused at the field, with nothing sent (sc-92's Conventions): blank clears a markup that is set, and is refused where none is. */
export function markupProblem(
  typed: string,
  language: MoneyLanguage,
  removable = false,
): MarkupProblem | null {
  const text = typed.trim();

  if (text === '') return removable ? null : 'number';
  if (/^[-−]/u.test(text)) return 'negative';
  const mark = DECIMAL[language] === '.' ? '\\.' : DECIMAL[language];
  const found = new RegExp(`^(\\d{1,6})(?:${mark}(\\d+))?$`, 'u').exec(text);
  if (found == null) return 'number';
  if ((found[2] ?? '').length > 1) return 'decimals';

  return Number(`${found[1]}.${found[2] ?? '0'}`) > MOST_MARKUP ? 'high' : null;
}

export function markupProblemWords(t: TFunction, problem: MarkupProblem, locale: string): string {
  const number = (value: number, digits: number) =>
    numberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
      value,
    );

  switch (problem) {
    case 'negative':
      return t('budget.margin.markupNegative', { min: number(0, 0) });
    case 'decimals':
      return t('budget.margin.markupDecimals', { count: 1, places: number(1, 0) });
    case 'high':
      return t('budget.margin.markupHigh', { max: percentWords(MOST_MARKUP, locale, 1) });
    default:
      return t('budget.margin.markupNumber', { example: number(12.5, 1) });
  }
}

/** A cost the margin face lists: every line that counts something, priced or at 0, since a line at 0 is charged only by a price entered there (sc-92, 20 Nov). */
export function listedOnMarginFace(line: BudgetLine): boolean {
  return line.quantity.count !== 0 && lineState(line) !== 'nothingYet';
}

/** Where the line's client price comes from, in the row's words. */
export function howWords(t: TFunction, line: ChargedLine, locale: string): string {
  const markup = line.markup == null ? '' : percentWords(line.markup, locale);

  switch (line.source) {
    case 'price':
      return t('budget.margin.how.price');
    case 'line':
      return Number(line.markup) === 0
        ? t('budget.margin.how.atCost')
        : t('budget.margin.how.line', { markup });
    case 'category':
      return Number(line.markup) === 0
        ? t('budget.margin.how.atCost')
        : t('budget.margin.how.category', {
            markup,
            category: t(`vendors.categories.${line.category}`),
          });
    case 'event':
      return Number(line.markup) === 0
        ? t('budget.margin.how.atCost')
        : t('budget.margin.how.event', { markup });
    default:
      return t('budget.margin.how.none');
  }
}

export function rowWords(
  t: TFunction,
  line: ChargedLine,
  currency: string,
  locale: string,
): string {
  return t('budget.margin.rowLine', {
    cost: minorMoney(line.cost.confirmed, currency, locale),
    charged: minorMoney(line.client.confirmed, currency, locale),
    how: howWords(t, line, locale),
  });
}

export function shareWords(t: TFunction, share: string | null, locale: string): string {
  return share == null ? t('budget.margin.noFigure') : percentWords(share, locale, 1);
}

/** The card's ranges in whole units (sc-92, "Picked, 7 Nov"): one figure when both ends agree. */
export function wholeRange(
  t: TFunction,
  pair: MarginFigures['client'],
  currency: string,
  locale: string,
): string {
  const low = wholeMoney(pair.confirmed, currency, locale);
  const high = wholeMoney(pair.potential, currency, locale);

  return low === high ? low : t('budget.range', { low, high });
}

export function shareRange(t: TFunction, figures: MarginFigures, locale: string): string {
  const low = shareWords(t, figures.share.confirmed, locale);
  const high = shareWords(t, figures.share.potential, locale);

  return low === high
    ? t('budget.margin.shareOne', { share: low })
    : t('budget.margin.shareRange', { low, high });
}

/** The margin a typed price gives, at the minor unit, worked in whole minor units so no float drifts. */
export function marginOfTyped(
  sent: string,
  cost: string,
  currency: string,
  locale: string,
): string {
  return minorMoney(
    amountOfMinor(minorOf(sent, currency) - minorOf(cost, currency), currency),
    currency,
    locale,
  );
}
