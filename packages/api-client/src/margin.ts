import { VENDOR_CATEGORIES, type VendorCategory } from './vendors.ts';
import { type CostBasis, asCostBasis } from './budget.ts';

/** Where a line's client price comes from (sc-92), nearest first; `none` is no markup set anywhere, so it is charged at cost. */
export type ChargeSource = 'price' | 'line' | 'category' | 'event' | 'none';

export interface MarginPair {
  confirmed: string;
  potential: string;
}

/** Amounts are decimal strings in the event's currency; a share is a percent to one decimal ("20.0"), null with a client price of 0. */
export interface MarginFigures {
  client: MarginPair;
  cost: MarginPair;
  margin: MarginPair;
  share: { confirmed: string | null; potential: string | null };
}

/** `markup` is the one the line is charged at ("12.5"), null for a price of its own. */
export interface ChargedLine extends MarginFigures {
  id: string;
  label: string;
  category: VendorCategory;
  basis: CostBasis;
  source: ChargeSource;
  markup: string | null;
  price: string | null;
}

/** sc-92's figures, read only with budget.margin on a plan with margin. */
export interface BudgetMargin {
  currency: string;
  markups: { event: string | null; categories: Partial<Record<VendorCategory, string>> };
  total: MarginFigures;
  categories: Partial<Record<VendorCategory, MarginFigures>>;
  lines: ChargedLine[];
}

/** One line's charge: a markup of its own, or a price of its own in the event's currency, or neither to take its category's or the event's. */
export type LineCharge = { markup: string } | { price: string; currency: string } | object;

const SOURCES: readonly ChargeSource[] = ['price', 'line', 'category', 'event', 'none'];

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value != null ? (value as Record<string, unknown>) : {};

const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

function asPair(value: unknown): MarginPair {
  const one = record(value);

  return {
    confirmed: textOrNull(one.confirmed) ?? '0',
    potential: textOrNull(one.potential) ?? '0',
  };
}

function asFigures(value: unknown): MarginFigures {
  const one = record(value);
  const share = record(one.share);

  return {
    client: asPair(one.client),
    cost: asPair(one.cost),
    margin: asPair(one.margin),
    share: { confirmed: textOrNull(share.confirmed), potential: textOrNull(share.potential) },
  };
}

function asCharged(value: unknown): ChargedLine | null {
  const one = record(value);
  const category = VENDOR_CATEGORIES.find((each) => each === one.category);
  const basis = asCostBasis(one.basis);
  if (typeof one.id !== 'string' || category == null || basis == null) return null;

  return {
    id: one.id,
    label: textOrNull(one.label) ?? '',
    category,
    basis,
    source: SOURCES.find((each) => each === one.source) ?? 'none',
    markup: textOrNull(one.markup),
    price: textOrNull(one.price),
    ...asFigures(one),
  };
}

function byCategory<T>(
  value: unknown,
  as: (one: unknown) => T,
): Partial<Record<VendorCategory, T>> {
  const one = record(value);

  return Object.fromEntries(
    VENDOR_CATEGORIES.filter((category) => one[category] != null).map((category) => [
      category,
      as(one[category]),
    ]),
  );
}

export function asBudgetMargin(value: unknown): BudgetMargin {
  const body = record(value);
  const markups = record(body.markups);

  return {
    currency: textOrNull(body.currency) ?? '',
    markups: {
      event: textOrNull(markups.event),
      categories: byCategory(markups.categories, (one) => textOrNull(one) ?? '0'),
    },
    total: asFigures(body.total),
    categories: byCategory(body.categories, asFigures),
    lines: (Array.isArray(body.lines) ? body.lines : [])
      .map(asCharged)
      .filter((line): line is ChargedLine => line != null),
  };
}
