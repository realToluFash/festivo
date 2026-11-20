import { numberFormat } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { amountOfMinor, minorMoney, minorOf } from './budgetArea.ts';
import { QUOTE_LIMITS, lengthOf } from './quotesArea.ts';

export type Shape = 'deposit' | 'instalments' | 'before' | 'after' | 'rows';

export const SHAPES: readonly Shape[] = ['deposit', 'instalments', 'before', 'after', 'rows'];

export type Called = 'deposit' | 'secondInstalment' | 'balance' | 'inFull';

export interface Term {
  called: Called;
  share: number;
  from: 'quoted' | 'before' | 'after';
  days: number;
}

const term = (called: Called, share: number, from: Term['from'], days = 0): Term => ({
  called,
  share,
  from,
  days,
});

/** sc-1332's table: each row a percentage of the quote, due on the date quoted or counted from the event's days. */
export const SHAPE_TERMS: Readonly<Record<Exclude<Shape, 'rows'>, readonly Term[]>> = {
  deposit: [term('deposit', 50, 'quoted'), term('balance', 50, 'before', 14)],
  instalments: [
    term('deposit', 50, 'quoted'),
    term('secondInstalment', 30, 'before', 60),
    term('balance', 20, 'before', 14),
  ],
  before: [term('inFull', 100, 'before', 14)],
  after: [term('inFull', 100, 'after', 7)],
};

export const SHAPE_LIMITS = { share: 100, days: 730 } as const;

export interface ShapeDraft {
  what: string;
  share: string;
  days: string;
}

export type ShapeField = keyof ShapeDraft;
export type ShapeProblems = Partial<Record<ShapeField, string>>;

export interface Shaping {
  shape: Shape;
  terms: readonly Term[];
  typed: readonly ShapeDraft[];
  problems: readonly ShapeProblems[];
}

export function shapingOf(t: TFunction, shape: Shape): Shaping {
  const terms = shape === 'rows' ? [] : SHAPE_TERMS[shape];

  return {
    shape,
    terms,
    typed: terms.map((one) => ({
      what: t(`quotes.shapeCalled.${one.called}`),
      share: String(one.share),
      days: String(one.days),
    })),
    problems: terms.map(() => ({})),
  };
}

export function typedShare(typed: string): number | null {
  const plain = typed.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(plain)) return null;
  const share = Number(plain);

  return share <= SHAPE_LIMITS.share ? share : null;
}

export function typedShapeDays(typed: string): number | null {
  const plain = typed.trim();
  if (!/^\d+$/.test(plain)) return null;
  const days = Number(plain);

  return days <= SHAPE_LIMITS.days ? days : null;
}

function rowProblems(t: TFunction, one: Term, draft: ShapeDraft): ShapeProblems {
  const problems: ShapeProblems = {};

  if (draft.what.trim() === '') problems.what = t('quotes.enterWhatFor');
  else if (lengthOf(draft.what) > QUOTE_LIMITS.description)
    problems.what = t('quotes.whatForTooLong', { max: QUOTE_LIMITS.description });
  if (typedShare(draft.share) == null) problems.share = t('quotes.enterShare');
  if (one.from !== 'quoted' && typedShapeDays(draft.days) == null)
    problems.days = t('quotes.enterShapeDays');

  return problems;
}

export function shapingProblems(t: TFunction, shaping: Shaping): ShapeProblems[] {
  return shaping.terms.map((one, index) =>
    rowProblems(t, one, shaping.typed[index] ?? { what: '', share: '', days: '' }),
  );
}

export function anyShapeProblem(problems: readonly ShapeProblems[]): boolean {
  return problems.some((one) => Object.keys(one).length > 0);
}

/** A row as typed; a percentage or a count of days not yet valid counts as 0 or as offered, and its field says so. */
export interface TypedTerm extends Term {
  what: string;
}

export function typedTerms(shaping: Shaping): TypedTerm[] {
  return shaping.terms.map((one, index) => {
    const draft = shaping.typed[index];

    return {
      ...one,
      what: draft?.what.trim() ?? '',
      share: typedShare(draft?.share ?? '') ?? 0,
      days: typedShapeDays(draft?.days ?? '') ?? one.days,
    };
  });
}

export function sharesTyped(shaping: Shaping): boolean {
  return shaping.typed.every((one) => typedShare(one.share) != null);
}

export function retyped(
  t: TFunction,
  shaping: Shaping,
  index: number,
  change: Partial<ShapeDraft>,
): Shaping {
  const next: Shaping = {
    ...shaping,
    typed: shaping.typed.map((one, at) => (at === index ? { ...one, ...change } : one)),
  };
  const now = shapingProblems(t, next);

  return {
    ...next,
    problems: shaping.problems.map((shown, at) => {
      const kept: ShapeProblems = {};
      for (const key of Object.keys(shown) as ShapeField[]) {
        const line = now[at]?.[key];
        if (line != null) kept[key] = line;
      }

      return kept;
    }),
  };
}

export interface EventDays {
  starts: string;
  ends: string;
}

/** The event's first and last calendar days in its own time zone (sc-98), so a reader elsewhere counts the same dates. */
export function eventDays(event: {
  startsAt: string;
  endsAt: string;
  timeZone: string;
}): EventDays {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: event.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return { starts: day.format(new Date(event.startsAt)), ends: day.format(new Date(event.endsAt)) };
}

export function addDays(day: string, days: number): string {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);

  return at.toISOString().slice(0, 10);
}

export interface ShapeRow extends TypedTerm {
  dueOn: string;
  clamped: boolean;
  amountMinor: number;
}

/** A row's amount in minor units, rounded half away from zero, as `percentage` hundredths of the quote. */
function shareOf(quotedMinor: number, hundredths: number): number {
  const exact = quotedMinor * hundredths;

  return Math.sign(exact) * Math.round(Math.abs(exact) / 10000);
}

/** Each row rounded to the minor unit; when the percentages come to 100 the last takes what is left, so the rows add up to the quote. */
export function shapeRows(
  terms: readonly TypedTerm[],
  quote: { amount: string; quotedOn: string },
  currency: string,
  days: EventDays,
): ShapeRow[] {
  const quoted = minorOf(quote.amount, currency);
  const parts = terms.map((one) => Math.round(one.share * 100));
  const whole = parts.reduce((sum, one) => sum + one, 0) === 10000;
  let given = 0;

  return terms.map((one, index) => {
    const counted =
      one.from === 'quoted'
        ? quote.quotedOn
        : one.from === 'before'
          ? addDays(days.starts, -one.days)
          : addDays(days.ends, one.days);
    const clamped = counted < quote.quotedOn;
    const amountMinor =
      whole && index === terms.length - 1 ? quoted - given : shareOf(quoted, parts[index] ?? 0);
    given += amountMinor;

    return { ...one, dueOn: clamped ? quote.quotedOn : counted, clamped, amountMinor };
  });
}

export function shareWords(share: number, locale: string): string {
  return numberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(share / 100);
}

export function whenWords(t: TFunction, row: Pick<Term, 'from' | 'days'>): string {
  if (row.from === 'quoted') return t('quotes.onTheDateQuoted');
  const key = row.from === 'before' ? 'quotes.daysBefore' : 'quotes.daysAfter';

  return row.days === 0 ? t(`${key}_zero`) : t(key, { count: row.days });
}

export function sharesLine(
  t: TFunction,
  rows: readonly ShapeRow[],
  quote: { amount: string },
  currency: string,
  locale: string,
): string | null {
  const total = rows.reduce((sum, one) => sum + Math.round(one.share * 100), 0) / 100;
  if (total === 100) return null;
  const scheduled = rows.reduce((sum, one) => sum + one.amountMinor, 0);
  const gap = minorMoney(
    amountOfMinor(Math.abs(minorOf(quote.amount, currency) - scheduled), currency),
    currency,
    locale,
  );

  return t(total < 100 ? 'quotes.sharesShort' : 'quotes.sharesOver', {
    percentage: shareWords(total, locale),
    gap,
  });
}

/** The API's refusals for a schedule: a row's description beside its field, anything else at the top; null when nothing was refused field by field. */
export function shapeRefusedAt(
  violations: Record<string, string>,
  count: number,
): { rows: ShapeProblems[]; top: string | null } | null {
  const paths = Object.entries(violations);
  if (paths.length === 0) return null;
  const rows: ShapeProblems[] = Array.from({ length: count }, () => ({}));
  let top: string | null = null;
  for (const [path, words] of paths) {
    const found = /^payments\[(\d+)\]\.description$/.exec(path);
    const row = found == null ? undefined : rows[Number(found[1])];
    if (row != null) row.what ??= words;
    else top ??= words;
  }

  return { rows, top };
}
