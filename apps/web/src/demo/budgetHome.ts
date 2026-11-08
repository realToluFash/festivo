import {
  type CostLine,
  COST_LINES,
  CURRENCY,
  DAYS,
  HEADS,
  TABLES,
  lineState,
  money,
  whole,
} from './budget.ts';
import { type CeilingKey, CEILINGS, budgetAt, ceilingState } from './budgetSample.ts';
import { type DemoGroup } from './budgetSample.ts';
import { type CeilingState } from './BudgetParts.tsx';
import { type Category } from './vendors.ts';
import { exampleIn, typedMinor } from './quotes.ts';
import { CATEGORY_WORDS } from './vendorsWords.ts';

/** The Budget home's states (spec §9: the Web board, the Ceiling board, and the margin and templates states drawn on the home). */
export const WEB_STATES = [
  'populated',
  'first_time',
  'loading',
  'zero_heads',
  'all_priced',
  'live_heads',
  'not_live',
  'failed',
  'not_found',
  'read_only',
  'rate_editing',
  'rate_blank',
  'rate_invalid',
  'rate_decimals',
  'rate_saving',
  'rate_saved',
  'rate_failed',
  'add_price',
  'removed_priced',
  'removed_not_priced',
  'removed_nothing_yet',
  'add_cost',
  'add_cost_blank',
  'add_cost_fixed',
  'add_cost_staff',
  'add_cost_failed',
  'add_cost_long_name',
  'add_cost_long_note',
  'add_cost_refused',
  'add_cost_negative',
  'add_cost_nan',
  'add_cost_decimals',
  'add_cost_adding',
  'add_cost_added',
] as const;

export const CEILING_STATES = [
  'ceiling_within',
  'ceiling_close',
  'ceiling_overif',
  'ceiling_over',
  'ceiling_none',
  'ceiling_set',
  'ceiling_change',
  'ceiling_negative',
  'ceiling_currency',
  'ceiling_nan',
  'ceiling_decimals',
  'ceiling_saved',
  'ceiling_cleared',
  'rate_warning',
  'ceiling_categories_only',
  'ceiling_live_set',
  'ceiling_live_changed',
  'ceiling_live_cleared',
  'ceiling_saving',
  'ceiling_refused',
  'ceiling_cleared_one',
  'ceiling_no_costs',
  'rate_warning_category',
  'rate_down_while_over',
] as const;

export const MARGIN_STATES = [
  'margin',
  'margin_before_paid',
  'markup',
  'markup_negative',
  'markup_cap',
  'markup_decimals',
  'markup_nan',
  'margin_zero_price',
  'price_negative',
  'price_decimals',
  'margin_live',
  'free',
] as const;

export const HOME_TEMPLATE_STATES = ['nothing_to_start', 'save_taken', 'save_blank', 'save_long'];

export const DUE_NOW_STATES = [
  'due_now',
  'due_marked',
  'due_changed',
  'due_refused',
  'due_done',
  'due_read_only',
] as const;

export const HOME_STATES: readonly string[] = [
  ...WEB_STATES,
  ...CEILING_STATES,
  ...MARGIN_STATES,
  ...HOME_TEMPLATE_STATES,
  ...DUE_NOW_STATES,
];

export interface Heads {
  coming: number;
  ifAllCome: number;
}

export function lineAmounts(line: CostLine, heads: Heads): { settled: number; ifAll: number } {
  if (lineState(line) !== 'priced' || line.rate == null) return { settled: 0, ifAll: 0 };
  switch (line.basis) {
    case 'perHead':
      return { settled: line.rate * heads.coming, ifAll: line.rate * heads.ifAllCome };
    case 'perDay':
      return { settled: line.rate * DAYS, ifAll: line.rate * DAYS };
    case 'perTable':
      return { settled: line.rate * TABLES, ifAll: line.rate * TABLES };
    case 'perStaffHour':
      return { settled: 0, ifAll: 0 };
    default:
      return { settled: line.rate, ifAll: line.rate };
  }
}

export function sumLines(
  lines: readonly CostLine[],
  heads: Heads,
): { settled: number; ifAll: number; notPriced: number } {
  return lines.reduce(
    (sum, line) => {
      const each = lineAmounts(line, heads);

      return {
        settled: sum.settled + each.settled,
        ifAll: sum.ifAll + each.ifAll,
        notPriced: sum.notPriced + (lineState(line) === 'notPriced' ? 1 : 0),
      };
    },
    { settled: 0, ifAll: 0, notPriced: 0 },
  );
}

export function headsOf(state: string): Heads {
  if (state === 'zero_heads') return { coming: 0, ifAllCome: HEADS.ifAllCome };
  if (state === 'live_heads') return { coming: HEADS.coming + 2, ifAllCome: HEADS.ifAllCome };

  return { coming: HEADS.coming, ifAllCome: HEADS.ifAllCome };
}

export function linesOf(state: string): CostLine[] {
  const lines = COST_LINES.map((line) => ({ ...line }));
  const set = (id: string, rate: number | null) => {
    const line = lines.find((one) => one.id === id);
    if (line != null) line.rate = rate;
  };

  if (state === 'all_priced') {
    set('arch', 45000);
    set('shuttle', 40000);
  }
  if (state === 'rate_saved') set('dinner', 7000);
  if (state === 'removed_priced') return lines.filter((one) => one.id !== 'dj');
  if (state === 'removed_not_priced') return lines.filter((one) => one.id !== 'arch');
  if (state === 'removed_nothing_yet') return lines.filter((one) => one.id !== 'centre');
  if (state === 'first_time' || state === 'nothing_to_start') return [];
  if (state === 'ceiling_refused') return lines.filter((one) => one.category !== GONE_CATEGORY);
  if (state === 'add_cost_added') return [...lines, { ...WELCOME_DRINKS }];

  return lines;
}

/** The ceilings a state starts with: the sample's, one of the Ceiling board's four for the whole event, or none. */
export function ceilingsOf(state: string): Partial<Record<CeilingKey, number>> {
  const whole = { ceiling_within: 2600000, ceiling_close: 2400000, ceiling_over: 1900000 }[
    state as 'ceiling_within' | 'ceiling_close' | 'ceiling_over'
  ];

  if (['ceiling_none', 'ceiling_set', 'ceiling_cleared', 'ceiling_live_cleared'].includes(state))
    return {};
  if (state === 'ceiling_saved') return { ...CEILINGS, hire: 0 };
  if (state === 'ceiling_categories_only') return { catering: 1300000, flowers: 150000 };
  if (state === 'ceiling_cleared_one' || state === 'ceiling_refused')
    return { whole: 2200000, catering: 1300000 };
  if (state === 'ceiling_no_costs') return { ...CEILINGS, hire: 0, other: 50000 };
  if (state === 'ceiling_live_changed') return { ...CEILINGS, whole: 2400000 };
  if (state === 'rate_warning_category') return { ...CEILINGS, whole: 2600000 };
  if (whole != null) return { ...CEILINGS, whole };

  return { ...CEILINGS };
}

export function ceilingOf(
  key: CeilingKey,
  ceiling: number,
  lines: readonly CostLine[],
  heads: Heads,
): { state: CeilingState; settled: number; ifAll: number } {
  const sum = sumLines(
    key === 'whole' ? lines : lines.filter((line) => line.category === key),
    heads,
  );

  return { state: ceilingState(sum.settled, sum.ifAll, ceiling), ...sum };
}

export const CEILING_KEYS: readonly CeilingKey[] = [
  'whole',
  ...(Object.keys(CATEGORY_WORDS) as Category[]),
];

export function ceilingName(key: CeilingKey): string {
  return key === 'whole' ? 'Whole event' : CATEGORY_WORDS[key];
}

// The checks that run on Save, at the field, before anything is sent (sc-83, sc-90, sc-92).
export function minorOf(typed: string, currency = CURRENCY): number {
  const found = typedMinor(typed.trim().replace(/^£/, ''), currency);

  return 'minor' in found ? found.minor : 0;
}

export function rateProblem(
  typed: string,
  label: 'rate' | 'amount' = 'rate',
  currency = CURRENCY,
): string | null {
  const found = typedMinor(typed, currency);

  if ('minor' in found) return null;
  if (found.wrong === 'blank') return label === 'rate' ? 'Enter the rate.' : 'Enter the amount.';
  if (found.wrong === 'decimals')
    return `That has too many decimal places for this event’s currency. Enter the ${label} like ${exampleIn(12, currency)}.`;

  return 'Enter a rate of 0 or more, in numbers only.';
}

/** A client price (sc-92): 0 or more, sc-83's decimals key; never a markup's words. */
export function priceProblem(typed: string, currency = CURRENCY): string | null {
  const found = typedMinor(typed, currency);

  if ('minor' in found) return null;
  if (found.wrong === 'decimals')
    return `That has too many decimal places for this event’s currency. Enter the price like ${exampleIn(12, currency)}.`;

  return 'Enter a price of 0 or more, in numbers only.';
}

export const WHAT_MAX = 100;
export const NOTE_MAX = 500;

/** Add a cost's two text checks (sc-85), the house over-limit shape. */
export function whatProblem(typed: string): string | null {
  if (typed.trim() === '') return 'Enter what it is.';

  return [...typed.trim()].length > WHAT_MAX
    ? `Shorten what it is to ${WHAT_MAX} characters or fewer.`
    : null;
}

export function noteProblem(typed: string): string | null {
  return [...typed.trim()].length > NOTE_MAX
    ? `Shorten the note to ${NOTE_MAX} characters or fewer.`
    : null;
}

/** sc-90's one refusal only the server gives (pm, 8 Nov): a category removed by someone else since the page opened. */
export const GONE_CATEGORY: Category = 'flowers';

export function categoryGone(name: string): string {
  return `${name} was removed, so its ceiling wasn’t saved.`;
}

/** The cost Add a cost's sample adds: Welcome drinks, £12.00 a head (Budget-A-Web-More, frame 34). */
export const WELCOME_DRINKS: CostLine = {
  id: 'new-welcome-drinks',
  name: 'Welcome drinks',
  category: 'catering',
  basis: 'perHead',
  rate: 1200,
};

export const STAFF_REFUSED =
  'The budget already has a staff-time cost. Choose another way it is counted.';

export function ceilingProblem(typed: string, currency = CURRENCY): string | null {
  const text = typed.trim();
  const example = exampleIn(20000, currency);

  if (/[€$¥£₦]/.test(text) && !text.startsWith(currency === 'GBP' ? '£' : '\u0000'))
    return `Enter the ceiling in ${currency}, the currency this event uses.`;
  const found = typedMinor(text.replace(/^£/, ''), currency);
  if ('minor' in found || found.wrong === 'blank') return null;
  if (found.wrong === 'negative') return 'The ceiling cannot be below 0. Enter 0 or more.';
  if (found.wrong === 'decimals')
    return `That has too many decimal places for this event’s currency. Enter the ceiling like ${example}.`;

  return `Enter the ceiling as a number, like ${example}.`;
}

function decimalsOf(typed: string): number {
  return typed.includes('.') ? (typed.split('.')[1]?.length ?? 0) : 0;
}

export function markupProblem(typed: string): string | null {
  const text = typed.trim();

  if (/^[-−]/.test(text))
    return 'A markup cannot be below 0. To sell below cost, enter the price instead.';
  if (!/^\d+(\.\d+)?$/.test(text)) return 'Enter the markup as a number, like 12.5.';
  if (decimalsOf(text) > 1) return 'Enter a markup with at most one decimal place.';
  if (Number(text) > 999.9) return 'Enter a markup of 999.9% or less.';

  return null;
}

export function fieldsWrong(count: number): string {
  return count === 1
    ? 'One field needs fixing, so nothing was sent.'
    : `${count} fields need fixing, so nothing was sent.`;
}

export function categoryCeilingsLine(ceilings: Partial<Record<CeilingKey, number>>): string | null {
  const whole_ = ceilings.whole;
  const parts = Object.entries(ceilings).filter(([key]) => key !== 'whole');

  if (whole_ == null || parts.length === 0) return null;
  const sum = parts.reduce((total, [, amount]) => total + (amount ?? 0), 0);
  const gap = Math.abs(whole_ - sum);
  if (gap === 0) return null;
  const said = gap < 100 ? money : whole;

  return `The category ceilings come to ${said(sum)}, ${said(gap)} ${
    sum < whole_ ? 'less' : 'more'
  } than the event’s ceiling.`;
}

export function removedWords(line: CostLine, settled: number): string {
  if (lineState(line) === 'notPriced')
    return `${line.name} removed. It had no price, so the total is the same.`;
  if (lineState(line) === 'nothingYet')
    return `${line.name} removed. Nothing was counted for it yet, so the total is the same.`;

  return `${line.name} removed. The settled total fell by ${whole(settled)}.`;
}

const at = budgetAt;

export const BUDGET_PAGES: readonly DemoGroup[] = [
  {
    name: 'The Budget page (Budget-A-Web)',
    states: [
      { to: at('populated'), name: 'In use: the card, the costs, Due next and the ceiling' },
      { to: at('first_time'), name: 'First time: what the event already knows' },
      { to: at('loading'), name: 'Loading' },
      { to: at('zero_heads'), name: 'Nobody has said yes yet' },
      { to: at('all_priced'), name: 'Every cost priced' },
      { to: at('live_heads'), name: 'A live change: 2 more said yes' },
      { to: at('not_live'), name: 'Not live, with Try now' },
      { to: at('failed'), name: 'Did not load' },
      { to: at('not_found', { as: 'kemi' }), name: 'Can edit: not available (as Kemi)' },
      { to: at('read_only'), name: 'Read only after a downgrade' },
      { to: at('early_on'), name: 'Early on: costs not priced, nothing scheduled, Add a price' },
      { to: at('nothing_due'), name: 'Near the end: nothing due, the ceiling’s sentence' },
    ],
  },
  {
    name: 'A cost, edited in place',
    states: [
      { to: at('rate_editing'), name: 'Dinner’s rate opened in place' },
      { to: at('rate_blank'), name: 'Blank' },
      { to: at('rate_invalid'), name: 'Not a number' },
      { to: at('rate_decimals'), name: 'Too many decimal places' },
      { to: at('rate_saving'), name: 'Saving' },
      { to: at('rate_saved'), name: 'Saved' },
      { to: at('rate_failed'), name: 'Not saved' },
      { to: at('add_price'), name: 'Add a price to Aisle arch' },
      { to: at('removed_priced'), name: 'DJ removed, with Undo' },
      { to: at('removed_not_priced'), name: 'A cost with no price removed' },
      { to: at('removed_nothing_yet'), name: 'A cost with nothing yet removed' },
    ],
  },
  {
    name: 'Add a cost',
    states: [
      { to: at('add_cost'), name: 'Add a cost, per head' },
      { to: at('add_cost_blank'), name: 'Refused: three blank fields' },
      { to: at('add_cost_fixed'), name: 'A fixed amount' },
      { to: at('add_cost_staff'), name: 'Staff time, already in the budget' },
      { to: at('add_cost_failed'), name: 'Not saved' },
      { to: at('add_cost_long_name'), name: 'Refused: what it is over 100 characters' },
      { to: at('add_cost_long_note'), name: 'Refused: a note over 500 characters' },
      {
        to: at('add_cost_refused'),
        name: 'Refused by the server: staff time added in another tab',
      },
      { to: at('add_cost_negative'), name: 'Refused: a rate below 0' },
      { to: at('add_cost_nan'), name: 'Refused: a rate that is not a number' },
      { to: at('add_cost_decimals'), name: 'Refused: too many decimal places' },
      { to: at('add_cost_adding'), name: 'Adding…, a second press does nothing' },
      { to: at('add_cost_added'), name: 'Added: the sheet closes, the new cost lit, Saved.' },
    ],
  },
  {
    name: 'The ceiling (Budget-A-Ceiling)',
    states: [
      { to: at('ceiling_within'), name: 'Within: £26,000' },
      { to: at('ceiling_close'), name: 'Close: £24,000' },
      { to: at('ceiling_overif'), name: 'Over if all come: £22,000' },
      { to: at('ceiling_over'), name: 'Over: £19,000' },
      { to: at('ceiling_none'), name: 'No ceiling' },
      { to: at('ceiling_set'), name: 'Set a ceiling' },
      { to: at('ceiling_change'), name: 'Change the ceiling' },
      { to: at('ceiling_negative'), name: 'Refused: below 0' },
      { to: at('ceiling_currency'), name: 'Refused: another currency' },
      { to: at('ceiling_nan'), name: 'Refused: not a number' },
      { to: at('ceiling_decimals'), name: 'Refused: too many decimal places' },
      { to: at('ceiling_decimals', { currency: 'JPY' }), name: 'The same, in yen' },
      { to: at('ceiling_decimals', { currency: 'KWD' }), name: 'The same, in dinars' },
      { to: at('ceiling_saved'), name: 'Saved, each category in the column' },
      { to: at('ceiling_cleared'), name: 'Cleared' },
      { to: at('rate_warning'), name: 'A rate that takes the event over its ceiling' },
      { to: at('rate_warning_category'), name: 'A rate that takes Catering over its ceiling' },
      { to: at('rate_down_while_over'), name: 'A rate lowered while over: no warning' },
      { to: at('ceiling_categories_only'), name: 'Category ceilings only, no whole event' },
      { to: at('ceiling_live_set'), name: 'Live: set in another tab' },
      { to: at('ceiling_live_changed'), name: 'Live: changed in another tab' },
      { to: at('ceiling_live_cleared'), name: 'Live: cleared in another tab' },
      { to: at('ceiling_saving'), name: 'Saving' },
      {
        to: at('ceiling_refused'),
        name: 'Refused by the server: Flowers was removed since the page opened',
      },
      { to: at('ceiling_cleared_one'), name: 'One ceiling cleared: Flowers' },
      { to: at('ceiling_no_costs'), name: 'A ceiling on a category with no costs' },
    ],
  },
  {
    name: 'Due now, from the payment reminder (Budget-A-Payments)',
    states: [
      { to: at('due_now'), name: 'Due now: two payments, Paid or Paid a different amount' },
      { to: at('due_marked'), name: 'One marked paid, with Undo' },
      { to: at('due_changed'), name: 'Changed since the reminder' },
      { to: at('due_refused'), name: 'A tap refused' },
      { to: at('due_done'), name: 'Nothing left to pay' },
      { to: at('due_read_only'), name: 'Read only after a downgrade' },
    ],
  },
  {
    name: 'Margin on the card, Enterprise (Budget-A-Plan)',
    states: [
      { to: at('margin'), name: 'Margin: the card’s four figures, Cost and Charged at' },
      { to: at('margin_before_paid'), name: 'Before any payment is marked paid' },
      { to: at('markup'), name: 'Markup' },
      { to: at('markup_negative'), name: 'Refused: below 0' },
      { to: at('markup_cap'), name: 'Refused: over 999.9%' },
      { to: at('markup_decimals'), name: 'Refused: two decimal places' },
      { to: at('markup_nan'), name: 'Refused: not a number' },
      { to: at('margin_zero_price'), name: 'A price of 0: no margin figure' },
      { to: at('price_negative'), name: 'A price refused: below 0' },
      { to: at('price_decimals'), name: 'A price refused: too many decimal places' },
      { to: at('margin_live'), name: 'Live: a markup changed in another tab' },
      { to: at('free', { plan: 'free' }), name: 'A Free organisation: no margin' },
    ],
  },
  {
    name: 'Templates on the Budget page (Budget-A-Templates)',
    states: [{ to: at('nothing_to_start'), name: 'First time with nothing to start from' }],
  },
];

export interface Markups {
  event: number;
  categories: Partial<Record<Category, number>>;
  costs: Readonly<Record<string, number>>;
  prices: Readonly<Record<string, number>>;
}

/** sc-92's sample: 20% on the event, Photography at 15%, Venue at cost (chosen), and a planning fee at its own price. */
export const MARKUPS: Markups = {
  event: 20,
  categories: { photography: 15, venue: 0 },
  costs: {},
  prices: {},
};

export const PLANNING_FEE = 300000;

const percentWords = (n: number): string => `${n}%`;

export function markupWords(line: CostLine, markups: Markups): string {
  if (markups.prices[line.id] != null) return 'its own price';
  const own = markups.costs[line.id];
  if (own != null) return own === 0 ? 'at cost, chosen' : `${percentWords(own)} markup, its own`;
  const category = markups.categories[line.category];
  if (category != null)
    return category === 0
      ? 'at cost, chosen'
      : `${percentWords(category)} markup, ${CATEGORY_WORDS[line.category]}’s`;

  return `${percentWords(markups.event)} markup, the event’s`;
}

export function chargedOf(
  line: CostLine,
  heads: Heads,
  markups: Markups,
): { cost: readonly [number, number]; charged: readonly [number, number] } {
  const each = lineAmounts(line, heads);
  const price = markups.prices[line.id];
  const percent = markups.costs[line.id] ?? markups.categories[line.category] ?? markups.event;
  const up = (minor: number) => Math.round((minor * (1000 + percent * 10)) / 1000);

  return {
    cost: [each.settled, each.ifAll],
    charged: price != null ? [price, price] : [up(each.settled), up(each.ifAll)],
  };
}

const shareOf = (margin: number, client: number): string =>
  `${client === 0 ? '0.0' : ((margin / client) * 100).toFixed(1)}%`;

export function marginOf(
  lines: readonly CostLine[],
  heads: Heads,
  markups: Markups,
  fee = PLANNING_FEE,
): {
  client: [number, number];
  cost: [number, number];
  margin: [number, number];
  share: [string, string];
} {
  const priced = lines.filter((line) => lineState(line) === 'priced');
  const sums = priced.reduce(
    (sum, line) => {
      const each = chargedOf(line, heads, markups);

      return {
        client: [sum.client[0] + each.charged[0], sum.client[1] + each.charged[1]] as [
          number,
          number,
        ],
        cost: [sum.cost[0] + each.cost[0], sum.cost[1] + each.cost[1]] as [number, number],
      };
    },
    { client: [fee, fee] as [number, number], cost: [0, 0] as [number, number] },
  );
  const margin: [number, number] = [sums.client[0] - sums.cost[0], sums.client[1] - sums.cost[1]];

  return {
    ...sums,
    margin,
    share: [shareOf(margin[0], sums.client[0]), shareOf(margin[1], sums.client[1])],
  };
}
