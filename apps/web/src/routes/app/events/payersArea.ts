import {
  type EventPayers,
  type Payer,
  type PayerCover,
  type PayerLine,
  type PayerSplit,
  type PayerTyped,
  type SplitTyped,
  VENDOR_CATEGORIES,
} from '@soirely/api-client';
import {
  type MoneyLanguage,
  listFormat,
  minorDigits,
  numberFormat,
  readAmount,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { minorMoney } from './budgetArea.ts';

export const PAYER_CAP = 20;
export const NAME_MAX = 60;
export const NOTE_MAX = 200;
/** A percentage is held in hundredths: 33.33% is 3333, and the whole is 10000. */
export const WHOLE = 10000;

export type Mode = 'one' | 'percent' | 'fixed';

export interface ChooseStart {
  ticked: readonly string[];
  mode: Mode;
  payer?: string;
  percents?: Readonly<Record<string, string>>;
  amounts?: Readonly<Record<string, string>>;
  rest?: string;
  checked?: boolean;
  stale?: string;
}

export interface PayersSource {
  read: () => Promise<EventPayers>;
  add: (typed: PayerTyped) => Promise<Payer>;
  change: (id: string, typed: PayerTyped) => Promise<Payer>;
  remove: (id: string) => Promise<void>;
  putBack: (id: string) => Promise<void>;
  choose: (
    lineIds: readonly string[],
    split: SplitTyped | null,
    currency: string,
  ) => Promise<EventPayers>;
}

export type Range = readonly [number, number];

const sum = (values: readonly number[]): number => values.reduce((all, one) => all + one, 0);

const characters = (text: string): number => [...text.trim()].length;

/** Each part rounded down, the minor units left over one each to the parts that lost most, between equal remainders the first added (sc-91): the parts add up exactly. */
export function apportion(amount: number, weights: readonly number[], whole: number): number[] {
  if (whole <= 0) return weights.map(() => 0);
  const parts = weights.map((weight) => Math.floor((amount * weight) / whole));
  const left = amount - sum(parts);
  if (left <= 0 || whole !== sum(weights)) return parts;
  const remainders = weights.map((weight) => (amount * weight) % whole);
  const byRemainder = weights
    .map((_, index) => index)
    .sort((a, b) => (remainders[b] ?? 0) - (remainders[a] ?? 0) || a - b);
  for (const index of byRemainder.slice(0, left)) parts[index] = (parts[index] ?? 0) + 1;

  return parts;
}

export function toMinor(amount: string, currency: string): number {
  return Math.round(Number(amount) * 10 ** minorDigits(currency));
}

export function fromMinor(minor: number, currency: string): string {
  const digits = minorDigits(currency);

  return (minor / 10 ** digits).toFixed(digits);
}

export function inBudgetOrder(lines: readonly PayerLine[]): PayerLine[] {
  return [...lines].sort(
    (a, b) => VENDOR_CATEGORIES.indexOf(a.category) - VENDOR_CATEGORIES.indexOf(b.category),
  );
}

export function categoriesOf(lines: readonly PayerLine[]): PayerLine['category'][] {
  return VENDOR_CATEGORIES.filter((category) => lines.some((one) => one.category === category));
}

export function nameProblem(
  t: TFunction,
  name: string,
  payers: readonly Pick<Payer, 'id' | 'name'>[],
  exceptId: string | null,
  locale: string,
): string | null {
  if (name.trim() === '') return t('payers.nameBlank');
  if (characters(name) > NAME_MAX) return t('payers.nameLong');
  const typed = name.trim().toLocaleLowerCase(locale);
  const same = payers.find(
    (one) => one.id !== exceptId && one.name.trim().toLocaleLowerCase(locale) === typed,
  );

  return same == null ? null : t('payers.sameName', { name: same.name });
}

export function noteProblem(t: TFunction, note: string): string | null {
  return characters(note) > NOTE_MAX ? t('payers.noteLong') : null;
}

export function named(split: PayerSplit): string[] {
  return split.mode === 'one'
    ? [split.payerId]
    : split.mode === 'percent'
      ? split.shares.map((one) => one.payerId)
      : [...split.amounts.map((one) => one.payerId), split.restId];
}

export function coveredBy(payers: EventPayers, payerId: string): string[] {
  return inBudgetOrder(payers.lines)
    .filter((line) => line.split != null && named(line.split).includes(payerId))
    .map((line) => line.id);
}

/** Typed as 33.33 or 33,33; empty is 0, so an empty payer is left out. Null when it is not a number with at most two decimals. */
export function percentOf(text: string): number | null {
  const typed = text.trim().replace(',', '.').replace('−', '-');
  if (typed === '') return 0;
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(typed)) return null;
  const [whole = '', part = ''] = typed.replace('-', '').split('.');
  if (part.length > 2) return null;
  const value = Number(whole === '' ? '0' : whole) * 100 + Number(`${part}00`.slice(0, 2));

  return typed.startsWith('-') ? -value : value;
}

/** What may be typed into a percentage at all: digits, one decimal mark and a leading minus, so a refusal can say what is wrong. */
export const PERCENT_TYPED = /^[-−]?\d{0,4}([.,]\d{0,4})?$/;

export type PercentProblem = 'range' | 'decimals';

export function percentProblem(text: string): PercentProblem | null {
  const typed = text.trim().replace(',', '.');
  if (typed === '') return null;
  if (/^\d*\.\d{3,}$/.test(typed) && Number(typed) <= WHOLE / 100) return 'decimals';
  const value = percentOf(typed);

  return value == null || value < 0 || value > WHOLE ? 'range' : null;
}

export function percentText(hundredths: number, locale: string): string {
  return numberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    hundredths / 100,
  );
}

export const sentPercent = (hundredths: number): string => (hundredths / 100).toFixed(2);

export function shortPercent(percent: string, locale: string): string {
  return numberFormat(locale, { maximumFractionDigits: 2 }).format(Number(percent));
}

export const choicesFor = (ticked: number): Mode[] =>
  ticked >= 2 ? ['one', 'percent'] : ['one', 'percent', 'fixed'];

export interface PercentCheck {
  total: number;
  parts: Map<string, Range>;
  fields: Readonly<Record<string, PercentProblem>>;
  shares: { payerId: string; percent: string }[];
  right: boolean;
}

export function checkPercents(
  payers: EventPayers,
  ticked: readonly string[],
  typed: Readonly<Record<string, string>>,
): PercentCheck {
  const values = payers.payers.map((one) => {
    const value = percentOf(typed[one.id] ?? '') ?? 0;

    return value < 0 ? 0 : value;
  });
  const total = sum(values);
  const parts = new Map<string, Range>();

  for (const line of payers.lines.filter((one) => ticked.includes(one.id))) {
    const lows = apportion(toMinor(line.cost.confirmed, payers.currency), values, WHOLE);
    const highs = apportion(toMinor(line.cost.potential, payers.currency), values, WHOLE);
    payers.payers.forEach((one, index) => {
      const now = parts.get(one.id) ?? [0, 0];
      parts.set(one.id, [now[0] + (lows[index] ?? 0), now[1] + (highs[index] ?? 0)]);
    });
  }
  const fields: Record<string, PercentProblem> = {};
  for (const one of payers.payers) {
    const problem = percentProblem(typed[one.id] ?? '');
    if (problem != null) fields[one.id] = problem;
  }
  const shares = payers.payers
    .map((one, index) => ({ payerId: one.id, value: values[index] ?? 0 }))
    .filter((one) => one.value > 0)
    .map((one) => ({ payerId: one.payerId, percent: sentPercent(one.value) }));

  return {
    total,
    parts,
    fields,
    shares,
    right: total === WHOLE && Object.keys(fields).length === 0 && shares.length > 0,
  };
}

export type FixedProblem = { kind: 'amount' } | { kind: 'over'; sum: number; least: number };

export interface FixedCheck {
  errors: Readonly<Record<string, FixedProblem>>;
  rest: Range;
  amounts: { payerId: string; amount: string }[];
}

/** Fixed amounts on one cost: each a number above 0 in the event's currency, together no more than the least it can cost. */
export function checkFixed(
  payers: EventPayers,
  lineId: string,
  typed: Readonly<Record<string, string>>,
  restId: string,
  language: MoneyLanguage,
): FixedCheck {
  const line = payers.lines.find((one) => one.id === lineId);
  const low = line == null ? 0 : toMinor(line.cost.confirmed, payers.currency);
  const high = line == null ? 0 : toMinor(line.cost.potential, payers.currency);
  const fields = payers.payers.filter((one) => one.id !== restId);
  const filled = fields.filter((one) => (typed[one.id] ?? '').trim() !== '');
  const errors: Record<string, FixedProblem> = {};
  const amounts: { payerId: string; amount: string }[] = [];
  let together = 0;

  for (const one of filled) {
    const read = readAmount((typed[one.id] ?? '').trim(), language, payers.currency);
    if (read == null || Number(read) <= 0) errors[one.id] = { kind: 'amount' };
    else {
      amounts.push({ payerId: one.id, amount: read });
      together += toMinor(read, payers.currency);
    }
  }
  const first = fields[0];
  if (filled.length === 0 && first != null) errors[first.id] = { kind: 'amount' };
  const firstFilled = filled[0];
  if (Object.keys(errors).length === 0 && together > low && firstFilled != null)
    errors[firstFilled.id] = { kind: 'over', sum: together, least: low };

  return {
    errors,
    rest: together > low ? [0, 0] : [low - together, high - together],
    amounts,
  };
}

export function moneyRange(
  t: TFunction,
  low: string,
  high: string,
  currency: string,
  locale: string,
): string {
  const lower = minorMoney(low, currency, locale);

  return Number(low) === Number(high)
    ? lower
    : t('budget.range', { low: lower, high: minorMoney(high, currency, locale) });
}

const nameOf = (payers: EventPayers, id: string): string =>
  payers.payers.find((one) => one.id === id)?.name ?? '';

const inPayerOrder = <T extends { payerId: string }>(parts: readonly T[], payers: EventPayers) => {
  const at = (id: string) => payers.payers.findIndex((one) => one.id === id);

  return [...parts].sort((a, b) => at(a.payerId) - at(b.payerId));
};

/** Who pays a cost now, in words: "Mum, all of it", "Mum and Dad, half each", "£400.00 from Aunt Funmi, the rest from Mum". */
export function splitWords(
  t: TFunction,
  payers: EventPayers,
  line: PayerLine,
  locale: string,
): string {
  const split = line.split;
  const list = (items: string[]) => listFormat(locale, { type: 'conjunction' }).format(items);

  if (split == null) return t('payers.noPayerYet');
  if (line.flagged) return t('payers.needsNewAmounts');
  if (split.mode === 'one') return t('payers.splitAll', { name: nameOf(payers, split.payerId) });
  if (split.mode === 'percent') {
    const shares = inPayerOrder(split.shares, payers);

    return shares.length === 2 && shares.every((one) => Number(one.percent) === 50)
      ? t('payers.splitHalves', { names: list(shares.map((one) => nameOf(payers, one.payerId))) })
      : list(
          shares.map((one) =>
            t('payers.fromPayer', {
              amount: t('payers.percentOf', { percent: shortPercent(one.percent, locale) }),
              name: nameOf(payers, one.payerId),
            }),
          ),
        );
  }

  return t('payers.splitFixed', {
    fixed: list(
      inPayerOrder(split.amounts, payers).map((one) =>
        t('payers.fromPayer', {
          amount: minorMoney(one.amount, payers.currency, locale),
          name: nameOf(payers, one.payerId),
        }),
      ),
    ),
    rest: nameOf(payers, split.restId),
  });
}

export function howWords(
  t: TFunction,
  payers: EventPayers,
  cover: PayerCover,
  locale: string,
): string {
  const how = cover.how;

  if (how.mode === 'one') return t('payers.allOfIt');
  if (how.mode === 'percent')
    return Number(how.percent) === 50
      ? t('payers.half')
      : t('payers.percentOf', { percent: shortPercent(how.percent, locale) });
  if (how.mode === 'fixed')
    return t('payers.fixedPart', { amount: minorMoney(how.amount, payers.currency, locale) });

  return t('payers.whatIsLeft', {
    after: listFormat(locale, { type: 'conjunction' }).format(
      inPayerOrder(how.after, payers).map((one) =>
        t('payers.theirs', {
          name: nameOf(payers, one.payerId),
          amount: minorMoney(one.amount, payers.currency, locale),
        }),
      ),
    ),
  });
}

export function flagWords(
  t: TFunction,
  payers: EventPayers,
  line: PayerLine,
  locale: string,
): { title: string; line: string } {
  const split = line.split;
  const fixed = split?.mode === 'fixed' ? inPayerOrder(split.amounts, payers) : [];
  const and = listFormat(locale, { type: 'conjunction' });
  const money = (minor: number) =>
    minorMoney(fromMinor(minor, payers.currency), payers.currency, locale);
  const kept = fixed.map((one) =>
    t('payers.flagKeeps', {
      name: nameOf(payers, one.payerId),
      amount: minorMoney(one.amount, payers.currency, locale),
    }),
  );
  const rest =
    split?.mode === 'fixed'
      ? [t('payers.flagRest', { name: nameOf(payers, split.restId), amount: money(0) })]
      : [];

  return {
    title: t('payers.flagTitle', { cost: line.label }),
    line: t('payers.flagLine', {
      cost: line.label,
      now: minorMoney(line.cost.confirmed, payers.currency, locale),
      fixed: money(sum(fixed.map((one) => toMinor(one.amount, payers.currency)))),
      by: and.format(fixed.map((one) => nameOf(payers, one.payerId))),
      shares: and.format([...kept, ...rest]),
    }),
  };
}

export function fixedForm(
  line: PayerLine | undefined,
  currency: string,
  write: (amount: string) => string,
): Pick<ChooseStart, 'amounts' | 'rest'> {
  if (line?.split?.mode !== 'fixed') return {};

  return {
    amounts: Object.fromEntries(
      line.split.amounts.map((one) => [
        one.payerId,
        write(Number(one.amount).toFixed(minorDigits(currency))),
      ]),
    ),
    rest: line.split.restId,
  };
}

/** The payers whose share moved since the last read, and the first of them for the live line; null when no share moved. */
export function movedShare(
  was: EventPayers,
  now: EventPayers,
): { name: string; by: number; down: boolean; ids: string[] } | null {
  const moves = now.payers.flatMap((payer) => {
    const before = was.payers.find((one) => one.id === payer.id);
    if (before == null) return [];
    const by =
      toMinor(payer.share.confirmed, now.currency) - toMinor(before.share.confirmed, now.currency);

    return by === 0 ? [] : [{ id: payer.id, name: payer.name, by }];
  });
  const first = moves[0];

  return first == null
    ? null
    : {
        name: first.name,
        by: Math.abs(first.by),
        down: first.by < 0,
        ids: moves.map((one) => one.id),
      };
}

export function openFirst(payers: readonly Payer[], asked: string | null): string | null {
  return payers.find((one) => one.id === asked)?.id ?? payers[0]?.id ?? null;
}
