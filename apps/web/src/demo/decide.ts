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
  'decide_nochange',
  'decide_updating',
  'decide_none',
  'decide_category',
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
        to: budgetAt('decide_nochange'),
        name: 'Nothing counted per guest: No change (decide_nochange)',
      },
      { to: budgetAt('decide_updating'), name: 'A companion added: updating (decide_updating)' },
      { to: budgetAt('decide_none'), name: 'No answer (decide_none)' },
      {
        to: budgetAt('decide_category'),
        name: 'It takes Catering over its ceiling (decide_category)',
      },
      { to: budgetAt('decide_rise', { as: 'kemi' }), name: 'No answer, as Can edit (&as=kemi)' },
      {
        to: budgetAt('decide_rise', { fetch: 'failed' }),
        name: 'No answer, the answer did not load (&fetch=failed)',
      },
    ],
  },
];

export type DecideKind = 'rise' | 'unknown' | 'nochange' | 'updating' | 'none' | 'category';

export function decideKindOf(state: string, as: string | null, fetch: string | null): DecideKind {
  if (as === 'kemi' || fetch === 'failed') return 'none';
  const kind = state.replace(/^decide_/u, '');

  return (
    (['rise', 'unknown', 'nochange', 'updating', 'none', 'category'] as const).find(
      (one) => one === kind,
    ) ?? 'rise'
  );
}

/** The Guests page's head behind the dialog (sc-1468, drawn on page 30), as the board draws it. */
export const BACKDROP: readonly { name: string; line: string }[] = [
  { name: 'Inês Duarte', line: 'Coming · with 1 companion' },
  { name: 'Kwame Mensah', line: 'Not sure yet' },
  { name: 'Lucía Ortega', line: 'Coming' },
  { name: 'Tomás Ferreira', line: 'No reply' },
];

export const GUEST = 'Marta Silva';
export const COMPANIONS: readonly string[] = ['Rui Silva', 'Inês Silva'];

/** Each state's budget: the wedding's, with Drinks package unpriced, or with nothing counted per guest. */
export function linesFor(kind: DecideKind): readonly CostLine[] {
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

export interface CategoryOver {
  name: string;
  ifAll: number;
  ceiling: number;
}

export interface Moved {
  name: string;
  category: Category;
  from: number;
  to: number;
  delta: number;
}

export interface Answer {
  delta: number;
  settled: number;
  ifAll: number;
  headsFrom: number;
  headsTo: number;
  moved: readonly Moved[];
  unknown: readonly string[];
  overCeiling: boolean;
  ceiling: number | null;
  categoriesOver: readonly CategoryOver[];
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
