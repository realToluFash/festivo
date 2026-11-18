import { writtenTime } from './clock.ts';
import {
  COST_LINES,
  HEADS,
  LOCALE,
  NOW,
  PAYMENTS,
  QUOTES,
  type CostLine,
  type EventQuote,
  type LineState,
  type Payment,
  categoriesOf,
  costLine,
  lineState,
  money,
  owed,
  rateWords,
  sumOf,
  whole,
  wholeRange,
} from './budget.ts';
import { type Heads, lineAmounts, sumLines } from './budgetHome.ts';
import { type DemoGroup, budgetAt } from './budgetSample.ts';
import { BUDGET_WORDS } from './budgetWords.ts';
import { PLAN_WORDS as W } from './planWords.ts';
import { type Category } from './vendors.ts';
import { CATEGORY_WORDS } from './vendorsWords.ts';

export const PLAN_STATES: readonly string[] = [
  'plan',
  'plan_unknown',
  'plan_across',
  'plan_zero_heads',
  'plan_after',
  'plan_unrecorded',
  'plan_after_no_yes',
  'plan_unrecorded_no_yes',
  'plan_empty',
  'plan_loading',
  'plan_failed',
  'plan_not_live',
  'print',
];

export const PLANNING_STATES: readonly string[] = [
  'planning',
  'planning_zero_heads',
  'planning_empty',
  'planning_loading',
  'planning_failed',
  'planning_not_live',
];

export const PLAN_PAGES: readonly DemoGroup[] = [
  {
    name: 'Against plan (sc-89)',
    states: [
      { to: budgetAt('plan'), name: 'During planning: four figures, never one actual (plan)' },
      {
        to: budgetAt('plan_unknown'),
        name: 'A quote over a cost not priced: Not known (plan_unknown)',
      },
      {
        to: budgetAt('plan_across'),
        name: 'Quotes not wholly in one category: one over three categories, one over no cost (plan_across)',
      },
      {
        to: budgetAt('plan_zero_heads'),
        name: 'Nobody has said yes: a quote over a plan of £0, the amount alone (plan_zero_heads)',
      },
      {
        to: budgetAt('plan_after'),
        name: 'After the event: per head of those who came (plan_after)',
      },
      { to: budgetAt('plan_unrecorded'), name: 'Attendance was not recorded (plan_unrecorded)' },
      {
        to: budgetAt('plan_after_no_yes'),
        name: 'After the event, nobody said yes: no planned per head (plan_after_no_yes)',
      },
      {
        to: budgetAt('plan_unrecorded_no_yes'),
        name: 'Nobody said yes and attendance was not recorded (plan_unrecorded_no_yes)',
      },
      { to: budgetAt('plan_empty'), name: 'No costs yet (plan_empty)' },
      { to: budgetAt('plan_loading'), name: 'Loading (plan_loading)' },
      { to: budgetAt('plan_failed'), name: 'Did not load, with Try again (plan_failed)' },
      { to: budgetAt('plan_not_live'), name: 'Not live, with Try now (plan_not_live)' },
      {
        to: budgetAt('plan', { as: 'kemi' }),
        name: 'Can edit, by a direct link: not available (as Kemi)',
      },
      { to: budgetAt('print'), name: 'Printed on A4, client figures only (print)' },
    ],
  },
  {
    name: 'What it will cost: the planning tier, without vendors (sc-89)',
    states: [
      { to: budgetAt('planning'), name: 'The range, per head and every cost (planning)' },
      {
        to: budgetAt('planning_zero_heads'),
        name: 'Nobody has said yes yet (planning_zero_heads)',
      },
      { to: budgetAt('planning_empty'), name: 'No costs yet (planning_empty)' },
      { to: budgetAt('planning_loading'), name: 'Loading (planning_loading)' },
      { to: budgetAt('planning_failed'), name: 'Did not load, with Try again (planning_failed)' },
      { to: budgetAt('planning_not_live'), name: 'Not live, with Try now (planning_not_live)' },
      {
        to: budgetAt('planning', { as: 'kemi' }),
        name: 'Can edit, by a direct link: not available (as Kemi)',
      },
    ],
  },
];

export type PlanKind = 'during' | 'unknown' | 'after' | 'unrecorded';

export function kindOf(state: string): PlanKind {
  if (state === 'plan_unknown') return 'unknown';
  if (state === 'plan_after' || state === 'plan_after_no_yes') return 'after';
  if (state === 'plan_unrecorded' || state === 'plan_unrecorded_no_yes') return 'unrecorded';

  return 'during';
}

export type PlanShown = 'figures' | 'empty' | 'loading' | 'failed' | 'notLive';

export function shownOf(state: string): PlanShown {
  if (state.endsWith('_empty')) return 'empty';
  if (state.endsWith('_loading')) return 'loading';
  if (state.endsWith('_failed')) return 'failed';
  if (state.endsWith('_not_live')) return 'notLive';

  return 'figures';
}

/** The directory's fixed ids (BRIEF), and Glow Lighting, quoted over no cost in plan_across. */
export const VENDOR_NAMES: Readonly<Record<string, string>> = {
  v3: 'Bloom & Co',
  v4: 'Savour Kitchen',
  v5: 'The Landmark',
  v6: 'Lens & Light',
  v9: 'Glow Lighting',
};

/** After the event, the board's sample: what was paid to vendors, and how many were checked in. */
export const AFTER = { paidToVendors: 2012500, came: 91 };

export interface PlanSample {
  lines: readonly CostLine[];
  quotes: readonly EventQuote[];
  payments: readonly Payment[];
  heads: Heads;
}

const SAID_YES: Heads = { coming: HEADS.coming, ifAllCome: HEADS.ifAllCome };
const NOBODY_YES: Heads = { coming: 0, ifAllCome: HEADS.ifAllCome };

/** plan_across: Savour Kitchen's quote also covers the waiting staff and the table linen, which has no price yet. */
export const ACROSS_LINES: readonly CostLine[] = [
  { id: 'staff', name: 'Waiting staff', category: 'staffing', basis: 'fixed', rate: 120000 },
  { id: 'linen', name: 'Table linen', category: 'hire', basis: 'fixed', rate: null },
];

const GLOW: EventQuote = {
  vendorId: 'v9',
  amount: 150000,
  quotedOn: '2026-10-19',
  number: 'GL-077',
  covers: 'Uplighting for the ballroom',
  lineIds: [],
  earlier: null,
};

const GLOW_PAYMENTS: readonly Payment[] = [
  {
    id: 'p9',
    vendorId: 'v9',
    what: 'Deposit',
    amount: 50000,
    dueOn: '2026-10-19',
    paid: { amount: 50000, on: '2026-10-19', by: 'Folake Adeyemi', reference: '' },
    cancelled: null,
  },
  {
    id: 'p10',
    vendorId: 'v9',
    what: 'Balance',
    amount: 100000,
    dueOn: '2026-11-06',
    paid: null,
    cancelled: null,
  },
];

export function sampleOf(state: string): PlanSample {
  const base = { lines: COST_LINES, quotes: QUOTES, payments: PAYMENTS, heads: SAID_YES };

  if (state.endsWith('_empty')) return { ...base, lines: [], quotes: [], payments: [] };
  if (state === 'plan_unknown')
    return {
      ...base,
      quotes: QUOTES.map((one) =>
        one.vendorId === 'v3' ? { ...one, lineIds: [...one.lineIds, 'arch'] } : one,
      ),
    };
  if (state === 'plan_across')
    return {
      ...base,
      lines: [...COST_LINES, ...ACROSS_LINES],
      quotes: [
        ...QUOTES.map((one) =>
          one.vendorId === 'v4' ? { ...one, lineIds: [...one.lineIds, 'staff', 'linen'] } : one,
        ),
        GLOW,
      ],
      payments: [...PAYMENTS, ...GLOW_PAYMENTS],
    };
  if (['plan_zero_heads', 'plan_after_no_yes', 'plan_unrecorded_no_yes'].includes(state))
    return { ...base, heads: NOBODY_YES };
  if (state === 'planning_zero_heads') return { ...base, heads: NOBODY_YES };

  return base;
}

const settledOf = (lines: readonly CostLine[], heads: Heads): number =>
  sumLines(lines, heads).settled;

const notPricedIn = (lines: readonly CostLine[]): number =>
  lines.filter((line) => lineState(line) === 'notPriced').length;

const paidTo = (payments: readonly Payment[]): number =>
  sumOf(
    payments.filter((one) => one.paid != null),
    (one) => one.paid?.amount ?? 0,
  );

export function fourOf(sample: PlanSample = sampleOf('plan')): {
  planned: number;
  committed: number;
  paid: number;
  stillToPay: number;
  notPriced: number;
} {
  return {
    planned: settledOf(sample.lines, sample.heads),
    committed: sample.quotes.reduce((sum, one) => sum + one.amount, 0),
    paid: paidTo(sample.payments),
    stillToPay: sumOf(sample.payments.filter(owed), (one) => one.amount),
    notPriced: notPricedIn(sample.lines),
  };
}

export interface Pair {
  label: string;
  figure: string;
  sub: string;
}

/** The card's four, in whole units: planned, committed, paid and still to pay, each its own figure. */
export function planPairs(sample: PlanSample = sampleOf('plan')): Pair[] {
  const four = fourOf(sample);
  const { payments } = sample;

  return [
    {
      label: W.planned,
      figure: whole(four.planned),
      sub: four.notPriced === 0 ? '' : BUDGET_WORDS.notPricedCount(four.notPriced),
    },
    { label: W.committed, figure: whole(four.committed), sub: W.quoted },
    {
      label: W.paid,
      figure: whole(four.paid),
      sub: W.payments(payments.filter((one) => one.paid != null).length),
    },
    {
      label: W.stillToPay,
      figure: whole(four.stillToPay),
      sub: W.scheduled(payments.filter(owed).length),
    },
  ];
}

/** A per head with nothing to divide by is left out, never 0 (pm, #25367). */
export function afterPairs(
  sample: PlanSample = sampleOf('plan_after'),
  recorded = true,
  after = AFTER,
): Pair[] {
  const { coming } = sample.heads;
  const planned = settledOf(sample.lines, sample.heads);

  return [
    coming === 0
      ? { label: W.plannedPerHead, figure: W.noFigure, sub: W.nobodyYes }
      : {
          label: W.plannedPerHead,
          figure: whole(Math.round(planned / coming)),
          sub: W.saidYes(coming),
        },
    ...(recorded
      ? [
          {
            label: W.paidPerHead,
            figure: whole(Math.round(after.paidToVendors / after.came)),
            sub: W.came(after.came),
          },
        ]
      : []),
    ...(coming === 0
      ? []
      : [
          {
            label: W.perHeadSaidYes(coming),
            figure: whole(Math.round(after.paidToVendors / coming)),
            sub: W.paidToVendorsLower,
          },
        ]),
    { label: W.paidToVendors, figure: whole(after.paidToVendors), sub: W.noVendorLeftOut },
  ];
}

export type Fact = { words: string; notKnown?: boolean };

export interface PlanRow {
  category: Category;
  name: string;
  planned: number;
  facts: readonly Fact[];
  vendorId: string | null;
}

type Shown = 'committed' | 'paid' | 'stillToPay' | 'variance';

/** Which of a quote's figures each category's row says, as the board words them. */
const SHOWN: Partial<Record<Category, readonly Shown[]>> = {
  catering: ['committed', 'paid', 'stillToPay'],
  venue: ['committed', 'paid', 'stillToPay'],
  flowers: ['committed', 'variance'],
  photography: ['committed', 'paid', 'variance'],
};

const SHARE = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Committed against the planned figure of the lines it covers: over and under in words, never by colour. */
export function varianceWords(committed: number, planned: number): string {
  const gap = committed - planned;
  const share = planned === 0 ? null : SHARE.format(Math.abs(gap) / planned);

  if (gap === 0) return W.matches;

  return gap > 0 ? W.over(money(gap), share) : W.under(money(-gap), share);
}

export function isAcross(quote: EventQuote, lines: readonly CostLine[]): boolean {
  const covered = lines.filter((line) => quote.lineIds.includes(line.id));

  return covered.length === 0 || new Set(covered.map((line) => line.category)).size > 1;
}

/** A quote's Against plan: the variance only where it covers a cost and every one is priced. */
function againstPlan(quote: EventQuote, covered: readonly CostLine[], heads: Heads): Fact[] {
  if (covered.length === 0) return [{ words: W.nothingPlanned }];
  const missing = notPricedIn(covered);
  if (missing > 0)
    return [{ words: W.notKnown, notKnown: true }, { words: BUDGET_WORDS.notPricedCount(missing) }];

  return [{ words: varianceWords(quote.amount, settledOf(covered, heads)) }];
}

function moneyFacts(quote: EventQuote, payments: readonly Payment[]): Record<Shown, string> {
  const theirs = payments.filter((one) => one.vendorId === quote.vendorId);

  return {
    committed: W.committedIs(money(quote.amount)),
    paid: W.paidIs(money(paidTo(theirs))),
    stillToPay: W.stillIs(money(sumOf(theirs.filter(owed), (one) => one.amount))),
    variance: '',
  };
}

/** One row per category in sc-82's order, planned in the minor unit, each quote's facts never split. */
export function planRows(sample: PlanSample = sampleOf('plan')): PlanRow[] {
  const { lines, quotes, payments, heads } = sample;
  const across = quotes.filter((one) => isAcross(one, lines));
  const theirs = new Set(across.flatMap((one) => one.lineIds));
  const left = lines.filter((line) => !theirs.has(line.id));

  return categoriesOf(left).map((category) => {
    const own = left.filter((line) => line.category === category);
    const quote = quotes.find(
      (one) =>
        !across.includes(one) && one.lineIds.every((id) => own.some((line) => line.id === id)),
    );
    const base = { category, name: CATEGORY_WORDS[category], planned: settledOf(own, heads) };

    if (quote == null) {
      const count = notPricedIn(own);
      const facts = [{ words: W.noQuote }];

      return {
        ...base,
        vendorId: null,
        facts: count === 0 ? facts : [...facts, { words: BUDGET_WORDS.notPricedCount(count) }],
      };
    }

    const covered = own.filter((line) => quote.lineIds.includes(line.id));
    const vendor = { words: VENDOR_NAMES[quote.vendorId] ?? quote.vendorId };
    const against = againstPlan(quote, covered, heads);

    if (against[0]?.notKnown === true)
      return { ...base, vendorId: quote.vendorId, facts: [vendor, ...against] };

    const said = { ...moneyFacts(quote, payments), variance: against[0]?.words ?? '' };
    const listed = SHOWN[category] ?? ['committed', 'paid', 'stillToPay', 'variance'];
    const zeroPlan = settledOf(covered, heads) === 0 && !listed.includes('variance');
    const shown: readonly Shown[] = zeroPlan ? [...listed, 'variance'] : listed;
    const elsewhere = notPricedIn(own);

    return {
      ...base,
      vendorId: quote.vendorId,
      facts: [
        vendor,
        ...shown.map((one) => ({ words: said[one] })),
        ...(elsewhere === 0 ? [] : [{ words: BUDGET_WORDS.notPricedCount(elsewhere) }]),
      ],
    };
  });
}

export interface AcrossCost {
  id: string;
  name: string;
  line: string;
  state: LineState;
  settled: number;
}

export interface AcrossRow {
  vendorId: string;
  vendor: string;
  categories: string;
  planned: number | null;
  notPriced: number;
  figures: string;
  against: readonly Fact[];
  costs: readonly AcrossCost[];
}

const perHeadLine = (line: CostLine, heads: Heads): string =>
  line.basis === 'perHead' && lineState(line) === 'priced'
    ? `${rateWords(line) ?? ''} × ${heads.coming} · said yes, from the guest list`
    : costLine(line);

export function acrossRows(sample: PlanSample = sampleOf('plan_across')): AcrossRow[] {
  const { lines, quotes, payments, heads } = sample;
  const order = Object.keys(CATEGORY_WORDS) as Category[];
  const name = (one: EventQuote): string => VENDOR_NAMES[one.vendorId] ?? one.vendorId;

  return quotes
    .filter((one) => isAcross(one, lines))
    .sort((a, b) => name(a).localeCompare(name(b), LOCALE))
    .map((quote) => {
      const covered = lines.filter((line) => quote.lineIds.includes(line.id));
      const categories = order.filter((one) => covered.some((line) => line.category === one));
      const said = moneyFacts(quote, payments);

      return {
        vendorId: quote.vendorId,
        vendor: name(quote),
        categories:
          categories.length === 0
            ? W.coversNoCost
            : categories.map((one) => CATEGORY_WORDS[one]).join(' · '),
        planned: covered.length === 0 ? null : settledOf(covered, heads),
        notPriced: notPricedIn(covered),
        figures: [said.committed, said.paid, said.stillToPay].join(' · '),
        against: againstPlan(quote, covered, heads),
        costs: covered.map((line) => ({
          id: line.id,
          name: line.name,
          line: `${CATEGORY_WORDS[line.category]} · ${perHeadLine(line, heads)}`,
          state: lineState(line),
          settled: lineAmounts(line, heads).settled,
        })),
      };
    });
}

export interface PlanningCategory {
  category: Category;
  name: string;
  costs: readonly AcrossCost[];
}

export function planningOf(sample: PlanSample = sampleOf('planning')): {
  range: string;
  notPriced: number;
  pairs: Pair[];
  categories: PlanningCategory[];
} {
  const { lines, heads } = sample;
  const sum = sumLines(lines, heads);

  return {
    range: wholeRange(sum.settled, sum.ifAll),
    notPriced: sum.notPriced,
    pairs: [
      heads.coming === 0
        ? { label: W.perHeadSettled, figure: W.noFigure, sub: W.nobodyYes }
        : {
            label: W.perHeadSettled,
            figure: whole(Math.round(sum.settled / heads.coming)),
            sub: W.forSaidYes(heads.coming),
          },
      {
        label: W.perHeadIfAll,
        figure: whole(Math.round(sum.ifAll / heads.ifAllCome)),
        sub: W.forAll(heads.ifAllCome),
      },
    ],
    categories: categoriesOf(lines).map((category) => ({
      category,
      name: CATEGORY_WORDS[category],
      costs: lines
        .filter((line) => line.category === category)
        .map((line) => ({
          id: line.id,
          name: line.name,
          line: perHeadLine(line, heads),
          state: lineState(line),
          settled: lineAmounts(line, heads).settled,
        })),
    })),
  };
}

const PRINT_DAY = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Europe/London',
});

/** When the sheet was printed, in the event's time zone, on the 24-hour clock. */
export function printedLine(at: Date = NOW): string {
  return W.printed(PRINT_DAY.format(at), writtenTime(at, LOCALE, 'Europe/London'));
}

export function sheetFigures(sample: PlanSample = sampleOf('plan')): {
  label: string;
  amount: string;
}[] {
  const four = fourOf(sample);

  return [
    { label: W.planned, amount: money(four.planned) },
    { label: W.committed, amount: money(four.committed) },
    { label: W.paid, amount: money(four.paid) },
    { label: W.stillToPay, amount: money(four.stillToPay) },
  ];
}
