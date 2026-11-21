import {
  COST_LINES,
  type CostLine,
  HEADS,
  amounts,
  lineState,
  money,
  totals,
  whole,
} from './budget.ts';
import { CEILINGS, type CeilingKey, type DemoGroup, budgetAt } from './budgetSample.ts';
import { type Category } from './vendors.ts';
import { CATEGORY_WORDS } from './vendorsWords.ts';

export const DECIDE_STATES: readonly string[] = [
  'decide_rise',
  'decide_unknown',
  'decide_unpriced',
  'decide_nochange',
  'decide_updating',
  'decide_none',
  'decide_category',
  'decide_huge',
];

export const DECIDE_PAGES: readonly DemoGroup[] = [
  {
    name: 'In Guests’ Add guest (sc-86)',
    states: [
      {
        to: budgetAt('decide_rise'),
        name: 'A guest and 2 companions: +£270 if all come (decide_rise)',
      },
      {
        to: budgetAt('decide_unknown'),
        name: 'A cost it moves has no price: Not known (decide_unknown)',
      },
      {
        to: budgetAt('decide_unpriced'),
        name: 'No cost it moves has a price: Not known if all come (decide_unpriced)',
      },
      {
        to: budgetAt('decide_nochange'),
        name: 'Nothing counted per guest: No change (decide_nochange)',
      },
      { to: budgetAt('decide_updating'), name: 'A companion added: updating (decide_updating)' },
      { to: budgetAt('decide_none'), name: 'No answer (decide_none)' },
      {
        to: budgetAt('decide_category'),
        name: 'It takes Catering over its ceiling (decide_category)',
      },
      {
        to: budgetAt('decide_huge'),
        name: 'The huge event: every figure exact, broken only between digit groups (decide_huge)',
      },
      {
        to: budgetAt('decide_huge', { lang: 'es' }),
        name: 'The huge event, in Spanish (decide_huge&lang=es)',
      },
      { to: budgetAt('decide_rise', { as: 'kemi' }), name: 'No answer, as Can edit (&as=kemi)' },
      {
        to: budgetAt('decide_rise', { fetch: 'failed' }),
        name: 'No answer, the answer did not load (&fetch=failed)',
      },
    ],
  },
];

export type DecideKind =
  'rise' | 'unknown' | 'unpriced' | 'nochange' | 'updating' | 'none' | 'category' | 'huge';

export function decideKindOf(state: string, as: string | null, fetch: string | null): DecideKind {
  if (as === 'kemi' || fetch === 'failed') return 'none';
  const kind = state.replace(/^decide_/u, '');

  return (
    (
      ['rise', 'unknown', 'unpriced', 'nochange', 'updating', 'none', 'category', 'huge'] as const
    ).find((one) => one === kind) ?? 'rise'
  );
}

/** The Guests list beside the Add guest column (sc-1468, drawn on page 30), as the board draws it. */
export const BACKDROP: readonly { name: string; line: string }[] = [
  { name: 'Inês Duarte', line: 'Coming · with 1 companion' },
  { name: 'Kwame Mensah', line: 'Not sure yet' },
  { name: 'Lucía Ortega', line: 'Coming' },
  { name: 'Tomás Ferreira', line: 'No reply' },
];

export const GUEST = 'Marta Silva';
export const COMPANIONS: readonly string[] = ['Rui Silva', 'Inês Silva'];

/** Each state's budget: the wedding's, with Drinks package unpriced, with no per-guest cost priced, or with nothing counted per guest. */
export function linesFor(kind: DecideKind): readonly CostLine[] {
  if (kind === 'unpriced')
    return COST_LINES.map((line) => (line.basis === 'perHead' ? { ...line, rate: null } : line));
  if (kind === 'unknown')
    return COST_LINES.map((line) => (line.id === 'drinks' ? { ...line, rate: null } : line));
  if (kind === 'nochange') return COST_LINES.filter((line) => line.basis !== 'perHead');

  return COST_LINES;
}

/** Each state's ceilings: the sample's, or the whole event at £26,000 with Catering at £12,000 (sc-90's line). */
export function ceilingsFor(kind: DecideKind): Partial<Record<CeilingKey, number>> {
  return kind === 'category'
    ? { whole: 2600000, catering: 1200000, flowers: 150000 }
    : { ...CEILINGS };
}

export interface CategoryOver<A = number> {
  name: string;
  ifAll: A;
  ceiling: A;
}

export interface Moved<A = number> {
  name: string;
  category: Category;
  from: A;
  to: A;
  delta: A;
}

/** The answer in the minor unit: a number for the sample wedding, a bigint for the huge event, past 2^53. */
export interface Answer<A = number> {
  delta: A;
  settled: A;
  ifAll: A;
  headsFrom: number;
  headsTo: number;
  moved: readonly Moved<A>[];
  unknown: readonly string[];
  overCeiling: boolean;
  ceiling: A | null;
  categoriesOver: readonly CategoryOver<A>[];
}

/** sc-86: new guests have not replied, so only the upper figure moves, by each per-head cost's rate. */
export function whatIf(
  added: number,
  lines: readonly CostLine[] = COST_LINES,
  ceilings: Partial<Record<CeilingKey, number>> = CEILINGS,
): Answer {
  const ceiling = ceilings.whole ?? null;
  const perHead = lines.filter((line) => line.basis === 'perHead');
  const moved = perHead
    .filter((line) => lineState(line) === 'priced' && added > 0)
    .map((line) => {
      const from = amounts(line).ifAll;
      const delta = (line.rate ?? 0) * added;

      return { name: line.name, category: line.category, from, to: from + delta, delta };
    });
  const delta = moved.reduce((sum, one) => sum + one.delta, 0);
  const sum = totals(lines);
  const ifAll = sum.ifAll + delta;

  return {
    delta,
    settled: sum.settled,
    ifAll,
    headsFrom: HEADS.ifAllCome,
    headsTo: HEADS.ifAllCome + added,
    moved,
    unknown:
      added > 0
        ? perHead.filter((line) => lineState(line) === 'notPriced').map((line) => line.name)
        : [],
    overCeiling: ceiling != null && ifAll > ceiling,
    ceiling,
    categoriesOver: (Object.keys(CATEGORY_WORDS) as Category[]).flatMap((category) => {
      const limit = ceilings[category];
      const rise = moved.filter((one) => one.category === category);
      if (limit == null || rise.length === 0) return [];
      const after =
        totals(lines.filter((line) => line.category === category)).ifAll +
        rise.reduce((sum, one) => sum + one.delta, 0);

      return after > limit
        ? [{ name: CATEGORY_WORDS[category], ifAll: after, ceiling: limit }]
        : [];
    }),
  };
}

/** The headline in whole units; a change under one unit in the minor unit, so a rise never reads +£0 (pm, 7 Nov). */
export function headline(delta: number): string {
  return delta < 100 ? money(delta) : whole(delta);
}

/** sc-72618's huge event (sc-71226 bullet 1): GBP, 100 guests all Coming, one per_head line at 999999999999999.99. */
export const HUGE = { heads: 100, rate: 99999999999999999n, line: 'Dinner' } as const;

/** sc-71226 bullet 5, exactly: the settled figure stays, the upper figure and the line move by the rate per head added. */
export function hugeWhatIf(added: number): Answer<bigint> {
  const settled = HUGE.rate * BigInt(HUGE.heads);
  const delta = HUGE.rate * BigInt(added);

  return {
    delta,
    settled,
    ifAll: settled + delta,
    headsFrom: HUGE.heads,
    headsTo: HUGE.heads + added,
    moved:
      added > 0
        ? [{ name: HUGE.line, category: 'catering', from: settled, to: settled + delta, delta }]
        : [],
    unknown: [],
    overCeiling: false,
    ceiling: null,
    categoriesOver: [],
  };
}

/** The API's decimal string for an amount in the minor unit, so Intl rounds the exact figure (half up), never a float. */
export function decimalOf(minor: bigint): string {
  const sign = minor < 0n ? '-' : '';
  const size = minor < 0n ? -minor : minor;

  return `${sign}${size / 100n}.${String(size % 100n).padStart(2, '0')}`;
}

/** Whole units at any size; a change under one unit in the minor unit, as headline() (pm, 7 Nov). */
export function exactWhole(minor: bigint, locale: string, under = false): string {
  const digits = under && minor !== 0n && minor < 100n && minor > -100n ? 2 : 0;

  return (
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
      // ECMA-402 formats a decimal string exactly; TypeScript's lib still types only number | bigint.
      .format(decimalOf(minor) as unknown as number)
      .replace('-', '−')
  );
}

/** A figure's pieces, each one ending after a group separator: a line may break between two, never inside one. */
export function groupsOf(figure: string): string[] {
  return figure.split(/(?<=\d[,.\u00a0\u202f ](?=\d{3}))/u);
}
