import {
  type BudgetLine,
  type CostBasis,
  type EventBudget,
  VENDOR_CATEGORIES,
  type VendorCategory,
  linePrice,
} from '@soirely/api-client';
import {
  type MoneyLanguage,
  minorDigits,
  numberFormat,
  readAmount,
  typedAmount,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

/** Never sharing a word or a mark (31 Oct): a line the API counts as waiting for a price is Not priced, a priced line counting 0 is Nothing yet. */
export type LineState = 'priced' | 'notPriced' | 'nothingYet';

export function lineState(line: BudgetLine): LineState {
  if (line.basis !== 'per_staff_hour' && line.notPriced) return 'notPriced';

  return line.quantity.count === 0 ? 'nothingYet' : 'priced';
}

export function wholeMoney(amount: string, currency: string, locale: string): string {
  return numberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function minorMoney(amount: string, currency: string, locale: string): string {
  const digits = minorDigits(currency);

  return numberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(amount));
}

export function currencySign(currency: string, locale: string): string {
  return (
    numberFormat(locale, { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  );
}

export function minorOf(amount: string, currency: string): number {
  return Math.round(Number(amount) * 10 ** minorDigits(currency));
}

export function amountOfMinor(minor: number, currency: string): string {
  const digits = minorDigits(currency);

  return (minor / 10 ** digits).toFixed(digits);
}

const DECIMAL: Record<MoneyLanguage, string> = { en: '.', fr: ',', es: ',', pt: ',' };

export type PriceProblem = 'blank' | 'number' | 'decimals';

/** sc-83's Form checks on a typed rate or amount: required, 0 or more, digits and the reader's marks only, and no more decimals than the currency has. */
export function priceProblem(
  typed: string,
  language: MoneyLanguage,
  currency: string,
): PriceProblem | null {
  const text = typed.trim();

  if (text === '') return 'blank';
  if (readAmount(text, language, currency) != null) return null;

  const mark = DECIMAL[language];
  const at = text.lastIndexOf(mark);
  const fraction = at < 0 ? '' : text.slice(at + 1);

  if (
    /^\d+$/u.test(fraction) &&
    fraction.length > minorDigits(currency) &&
    readAmount(text.slice(0, at), language, currency) != null
  )
    return 'decimals';

  return 'number';
}

export function priceProblemWords(
  t: TFunction,
  problem: PriceProblem,
  fixed: boolean,
  language: MoneyLanguage,
  currency: string,
): string {
  if (problem === 'blank') return t(fixed ? 'budget.amountBlank' : 'budget.rateBlank');
  if (problem === 'decimals')
    return t(fixed ? 'budget.amountDecimals' : 'budget.rateDecimals', {
      example: typedAmount(minorDigits(currency) === 0 ? '12' : '12.5', language, currency),
    });

  return t('budget.rateNumber');
}

export const WHAT_MAX = 100;
export const NOTE_MAX = 500;

export const characters = (typed: string): number => [...typed.trim()].length;

export function rateWords(t: TFunction, line: BudgetLine, locale: string): string | null {
  const price = linePrice(line);
  if (price == null) return null;
  const money = minorMoney(price, line.currency, locale);

  return line.basis === 'fixed' ? money : t(`budget.unit.${line.basis}`, { rate: money });
}

export function reasonWords(t: TFunction, reason: string | null): string {
  return t(`budget.reason.${reason ?? 'none'}`, { defaultValue: t('budget.reason.none') });
}

export function rowLine(t: TFunction, line: BudgetLine, locale: string): string {
  const state = lineState(line);
  const rate = rateWords(t, line, locale);

  if (state === 'notPriced') return t('budget.noPriceYet');
  if (state === 'nothingYet')
    return [rate, t('budget.nothingYet'), reasonWords(t, line.quantity.reason)]
      .filter((one) => one != null)
      .join(' · ');
  if (line.basis === 'fixed') return t('budget.source.fixed');

  const count = numberFormat(locale).format(line.quantity.count);

  return line.basis === 'per_staff_hour'
    ? t('budget.staffLine', { count: line.quantity.count, hours: count })
    : t('budget.quantityLine', {
        rate: rate ?? '',
        quantity: count,
        source: t(`budget.source.${line.quantity.source}`),
      });
}

export function categoriesOf(lines: readonly BudgetLine[]): VendorCategory[] {
  return VENDOR_CATEGORIES.filter((category) => lines.some((one) => one.category === category));
}

export function basisLine(
  t: TFunction,
  budget: EventBudget,
  basis: CostBasis,
  locale: string,
): string {
  const quantity = budget.quantities[basis];
  const count = numberFormat(locale).format(quantity.count);

  if (basis === 'per_staff_hour') return t('budget.basisLine.per_staff_hour');
  if (basis === 'fixed') return t('budget.basisLine.fixed');
  if (quantity.count === 0) return reasonWords(t, quantity.reason);
  if (basis === 'per_head')
    return t('budget.basisLine.per_head', {
      quantity: count,
      ifAll: numberFormat(locale).format(budget.perHead.potential.heads),
    });

  return t(`budget.basisLine.${basis}`, { count: quantity.count, shown: count });
}

export function removedWords(t: TFunction, line: BudgetLine, locale: string): string {
  const state = lineState(line);

  if (state === 'notPriced') return t('budget.removedNotPriced', { name: line.label });
  if (state === 'nothingYet') return t('budget.removedNothingYet', { name: line.label });
  if (Number(line.cost.confirmed) === 0)
    return t('budget.removedCostNothing', { name: line.label });

  return t('budget.removed', {
    name: line.label,
    amount: wholeMoney(line.cost.confirmed, line.currency, locale),
  });
}

/** One line saying what another tab or a guest's answer changed; null when nothing a reader sees moved. A line back with an id this tab has shown was put back by an Undo, not added. */
export function liveWords(
  t: TFunction,
  was: EventBudget,
  now: EventBudget,
  locale: string,
  known: ReadonlySet<string> = new Set(),
): string | null {
  const before = new Map(was.lines.map((line) => [line.id, line]));
  const after = new Map(now.lines.map((line) => [line.id, line]));
  const added = now.lines.filter((line) => !before.has(line.id));
  const removed = was.lines.filter((line) => !after.has(line.id));
  const changed = now.lines.filter((line) => {
    const old = before.get(line.id);

    return (
      old != null &&
      (old.rate !== line.rate ||
        old.amount !== line.amount ||
        old.label !== line.label ||
        old.category !== line.category ||
        old.basis !== line.basis ||
        old.notPriced !== line.notPriced)
    );
  });
  const moved = minorOf(now.confirmed, now.currency) - minorOf(was.confirmed, was.currency);
  const by = wholeMoney(amountOfMinor(Math.abs(moved), now.currency), now.currency, locale);
  const total =
    moved === 0
      ? t('budget.live.same')
      : moved > 0
        ? t('budget.live.up', { amount: by })
        : t('budget.live.down', { amount: by });
  const count =
    now.notPriced !== was.notPriced && now.notPriced > 0
      ? ` ${t('budget.notPricedCount', { count: now.notPriced })}.`
      : '';
  const one = added[0] ?? removed[0] ?? changed[0];
  const lines = added.length + removed.length + changed.length;

  if (lines === 1 && one != null) {
    const key =
      added.length === 1
        ? known.has(one.id)
          ? 'budget.live.putBack'
          : lineState(one) === 'notPriced'
            ? 'budget.live.addedNoPrice'
            : 'budget.live.added'
        : removed.length === 1
          ? 'budget.live.removed'
          : lineState(one) !== 'notPriced' && lineState(before.get(one.id) ?? one) === 'notPriced'
            ? 'budget.live.priced'
            : 'budget.live.changed';

    return `${t(key, { name: one.label, rate: rateWords(t, one, locale) ?? '', change: total })}${count}`;
  }
  if (lines > 1) return `${t('budget.live.several', { count: lines, change: total })}${count}`;

  const heads = now.perHead.confirmed.heads - was.perHead.confirmed.heads;
  if (heads > 0) return t('budget.live.moreHeads', { count: heads, change: total });
  if (heads < 0) return t('budget.live.fewerHeads', { count: -heads, change: total });
  if (moved !== 0 || now.potential !== was.potential)
    return t('budget.live.counts', { change: total });

  return null;
}

export function sentPrice(typed: string, language: MoneyLanguage, currency: string): string | null {
  return readAmount(typed, language, currency);
}
