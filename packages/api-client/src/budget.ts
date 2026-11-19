import { VENDOR_CATEGORIES, type VendorCategory } from './vendors.ts';

/** What a line's rate is multiplied by (sc-83), in the order Add a cost offers them. */
export const COST_BASES = ['per_head', 'per_table', 'per_staff_hour', 'per_day', 'fixed'] as const;
export type CostBasis = (typeof COST_BASES)[number];

export type QuantitySource = 'accepted' | 'seating_tables' | 'staff_hours' | 'event_days' | 'fixed';

/** How many of a basis the event has, where that came from, and why it is 0 when its source has nothing yet. */
export interface BudgetQuantity {
  count: number;
  source: QuantitySource;
  reason: string | null;
}

/** Amounts are the API's decimal strings in the event's currency ("68.00"); a line's price is `rate`, or `amount` on a fixed line, and neither on staff time. */
export interface BudgetLine {
  id: string;
  label: string;
  category: VendorCategory;
  basis: CostBasis;
  rate: string | null;
  amount: string | null;
  currency: string;
  note: string | null;
  quantity: BudgetQuantity;
  cost: { confirmed: string; potential: string };
}

export interface BudgetPerHead {
  amount: string | null;
  heads: number;
}

/** sc-84's range: never one figure, per head null with nobody to divide by. */
export interface EventBudget {
  currency: string;
  confirmed: string;
  potential: string;
  perHead: { confirmed: BudgetPerHead; potential: BudgetPerHead };
  notPriced: number;
  quantities: Record<CostBasis, BudgetQuantity>;
  lines: BudgetLine[];
}

/** What Add a cost and a rate's change send: the API trims and checks each field (sc-83's Form checks). */
export interface BudgetLineTyped {
  label: string;
  category: string;
  basis: string;
  rate?: string;
  amount?: string;
  currency?: string;
  note?: string;
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value != null ? (value as Record<string, unknown>) : {};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const whole = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const SOURCES: readonly QuantitySource[] = [
  'accepted',
  'seating_tables',
  'staff_hours',
  'event_days',
  'fixed',
];

function asQuantity(value: unknown): BudgetQuantity {
  const one = record(value);
  const source = SOURCES.find((each) => each === one.source) ?? 'fixed';

  return { count: whole(one.count), source, reason: textOrNull(one.reason) };
}

export function asCostBasis(value: unknown): CostBasis | null {
  return COST_BASES.find((one) => one === value) ?? null;
}

function asLine(value: unknown): BudgetLine | null {
  const one = record(value);
  const category = VENDOR_CATEGORIES.find((each) => each === one.category);
  const basis = asCostBasis(one.basis);
  if (typeof one.id !== 'string' || category == null || basis == null) return null;
  const cost = record(one.cost);

  return {
    id: one.id,
    label: text(one.label),
    category,
    basis,
    rate: textOrNull(one.rate),
    amount: textOrNull(one.amount),
    currency: text(one.currency),
    note: textOrNull(one.note),
    quantity: asQuantity(one.quantity),
    cost: { confirmed: text(cost.confirmed) || '0', potential: text(cost.potential) || '0' },
  };
}

function asPerHead(value: unknown): BudgetPerHead {
  const one = record(value);

  return { amount: textOrNull(one.amount), heads: whole(one.heads) };
}

export function asEventBudget(value: unknown): EventBudget {
  const body = record(value);
  const perHead = record(body.perHead);
  const quantities = record(body.quantities);

  return {
    currency: text(body.currency),
    confirmed: text(body.confirmed) || '0',
    potential: text(body.potential) || '0',
    perHead: { confirmed: asPerHead(perHead.confirmed), potential: asPerHead(perHead.potential) },
    notPriced: whole(body.notPriced),
    quantities: Object.fromEntries(
      COST_BASES.map((basis) => [basis, asQuantity(quantities[basis])]),
    ) as Record<CostBasis, BudgetQuantity>,
    lines: (Array.isArray(body.lines) ? body.lines : [])
      .map(asLine)
      .filter((line): line is BudgetLine => line != null),
  };
}

/** The line's price as typed, whichever field holds it. */
export function linePrice(line: Pick<BudgetLine, 'rate' | 'amount'>): string | null {
  return line.rate ?? line.amount;
}
