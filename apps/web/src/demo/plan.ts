import {
  COST_LINES,
  HEADS,
  LOCALE,
  NOW,
  PAYMENTS,
  QUOTES,
  type CostLine,
  type EventQuote,
  type Payment,
  categoriesOf,
  lineState,
  money,
  owed,
  perHead,
  plan,
  sumOf,
  totals,
  whole,
} from './budget.ts';
import { type DemoGroup, budgetAt } from './budgetSample.ts';
import { BUDGET_WORDS } from './budgetWords.ts';
import { PLAN_WORDS as W } from './planWords.ts';
import { type Category } from './vendors.ts';
import { CATEGORY_WORDS } from './vendorsWords.ts';

export const PLAN_STATES: readonly string[] = [
  'plan',
  'plan_unknown',
  'plan_after',
  'plan_unrecorded',
  'print',
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
        to: budgetAt('plan_after'),
        name: 'After the event: per head of those who came (plan_after)',
      },
      { to: budgetAt('plan_unrecorded'), name: 'Attendance was not recorded (plan_unrecorded)' },
      { to: budgetAt('print'), name: 'Printed on A4, client figures only (print)' },
    ],
  },
];

export type PlanKind = 'during' | 'unknown' | 'after' | 'unrecorded';

export function kindOf(state: string): PlanKind {
  if (state === 'plan_unknown') return 'unknown';
  if (state === 'plan_after') return 'after';
  if (state === 'plan_unrecorded') return 'unrecorded';

  return 'during';
}

/** The directory's fixed ids (BRIEF): the four vendors quoted on the wedding. */
export const VENDOR_NAMES: Readonly<Record<string, string>> = {
  v3: 'Bloom & Co',
  v4: 'Savour Kitchen',
  v5: 'The Landmark',
  v6: 'Lens & Light',
};

/** After the event, the board's sample: what was paid to vendors, and how many were checked in. */
export const AFTER = { paidToVendors: 2012500, came: 91 };

export interface Pair {
  label: string;
  figure: string;
  sub: string;
}

/** The card's four, in whole units: planned, committed, paid and still to pay, each its own figure. */
export function planPairs(
  lines: readonly CostLine[] = COST_LINES,
  quotes: readonly EventQuote[] = QUOTES,
  payments: readonly Payment[] = PAYMENTS,
): Pair[] {
  const four = plan(lines, quotes, payments);
  const notPriced = totals(lines).notPriced;

  return [
    {
      label: W.planned,
      figure: whole(four.planned),
      sub: notPriced === 0 ? '' : BUDGET_WORDS.notPricedCount(notPriced),
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

export function afterPairs(after = AFTER): Pair[] {
  const settled = perHead().settled;

  return [
    {
      label: W.plannedPerHead,
      figure: settled == null ? '' : whole(settled),
      sub: W.saidYes(HEADS.coming),
    },
    {
      label: W.paidPerHead,
      figure: whole(Math.round(after.paidToVendors / after.came)),
      sub: W.came(after.came),
    },
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

/** In the plan_unknown state, Bloom & Co's quote also covers the Aisle arch, which has no price. */
export function quotesFor(unknown: boolean): readonly EventQuote[] {
  return unknown
    ? QUOTES.map((one) =>
        one.vendorId === 'v3' ? { ...one, lineIds: [...one.lineIds, 'arch'] } : one,
      )
    : QUOTES;
}

const notPricedIn = (lines: readonly CostLine[]): number =>
  lines.filter((line) => lineState(line) === 'notPriced').length;

/** One row per category in sc-82's order, planned in the minor unit, each quote's facts never split. */
export function planRows(
  unknown = false,
  lines: readonly CostLine[] = COST_LINES,
  payments: readonly Payment[] = PAYMENTS,
): PlanRow[] {
  const quotes = quotesFor(unknown);

  return categoriesOf(lines).map((category) => {
    const own = lines.filter((line) => line.category === category);
    const quote = quotes.find(
      (one) =>
        one.lineIds.length > 0 && one.lineIds.every((id) => own.some((line) => line.id === id)),
    );
    const base = { category, name: CATEGORY_WORDS[category], planned: totals(own).settled };

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
    const missing = notPricedIn(covered);
    const theirs = payments.filter((one) => one.vendorId === quote.vendorId);
    const vendor = { words: VENDOR_NAMES[quote.vendorId] ?? quote.vendorId };

    if (missing > 0)
      return {
        ...base,
        vendorId: quote.vendorId,
        facts: [
          vendor,
          { words: W.notKnown, notKnown: true },
          { words: BUDGET_WORDS.notPricedCount(missing) },
        ],
      };

    const said: Record<Shown, string> = {
      committed: W.committedIs(money(quote.amount)),
      paid: W.paidIs(
        money(
          sumOf(
            theirs.filter((one) => one.paid != null),
            (one) => one.paid?.amount ?? 0,
          ),
        ),
      ),
      stillToPay: W.stillIs(money(sumOf(theirs.filter(owed), (one) => one.amount))),
      variance: varianceWords(quote.amount, totals(covered).settled),
    };
    const shown = SHOWN[category] ?? ['committed', 'paid', 'stillToPay', 'variance'];

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

const PRINT_DAY = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Europe/London',
});
const PRINT_TIME = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/London',
});

/** When the sheet was printed, in the event's time zone, on the 24-hour clock. */
export function printedLine(at: Date = NOW): string {
  return W.printed(PRINT_DAY.format(at), PRINT_TIME.format(at));
}

export function sheetFigures(): { label: string; amount: string }[] {
  const four = plan();

  return [
    { label: W.planned, amount: money(four.planned) },
    { label: W.committed, amount: money(four.committed) },
    { label: W.paid, amount: money(four.paid) },
    { label: W.stillToPay, amount: money(four.stillToPay) },
  ];
}
