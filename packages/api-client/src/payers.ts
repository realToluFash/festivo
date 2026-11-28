import { VENDOR_CATEGORIES, type VendorCategory } from './vendors.ts';

/** Both ends of a range, as decimal strings in the event's currency: settled, and if all come. */
export interface PayerPair {
  confirmed: string;
  potential: string;
}

/** How a payer's part of one cost was agreed (sc-91): all of it, a percentage, a fixed amount, or what is left after the fixed amounts. */
export type CoverHow =
  | { mode: 'one' }
  | { mode: 'percent'; percent: string }
  | { mode: 'fixed'; amount: string }
  | { mode: 'rest'; after: { payerId: string; amount: string }[] };

export interface PayerCover {
  lineId: string;
  label: string;
  notPriced: boolean;
  part: PayerPair;
  how: CoverHow;
}

/** `paid` and `stillToCome` are null when nothing can be paid on the event (sc-91, "Paid, and still to come"). */
export interface Payer {
  id: string;
  name: string;
  note: string | null;
  share: PayerPair;
  notPriced: number;
  paid: string | null;
  stillToCome: PayerPair | null;
  covers: PayerCover[];
}

/** A cost's choice of who pays; a percentage is a decimal string with two places ("33.33"). */
export type PayerSplit =
  | { mode: 'one'; payerId: string }
  | { mode: 'percent'; shares: { payerId: string; percent: string }[] }
  | { mode: 'fixed'; amounts: { payerId: string; amount: string }[]; restId: string };

export interface PayerLine {
  id: string;
  label: string;
  category: VendorCategory;
  cost: PayerPair;
  notPriced: boolean;
  flagged: boolean;
  split: PayerSplit | null;
}

/** Who is paying (sc-91), worked out on the server on every read. */
export interface EventPayers {
  currency: string;
  paidShown: boolean;
  total: PayerPair;
  hasPayer: PayerPair;
  noPayer: PayerPair & { costs: number; paid: string };
  next: { id: string; label: string } | null;
  payers: Payer[];
  lines: PayerLine[];
}

export interface PayerTyped {
  name: string;
  note: string | null;
}

/** Saving a choice: null leaves the costs with no payer. A field left unchosen goes as null, so the server names it. */
export type SplitTyped =
  | { mode: 'one'; payerId: string | null }
  | { mode: 'percent'; shares: { payerId: string; percent: string }[] }
  | { mode: 'fixed'; amounts: { payerId: string; amount: string }[]; restId: string | null };

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value != null ? (value as Record<string, unknown>) : {};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const whole = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) ? value : 0;

function asPair(value: unknown): PayerPair {
  const one = record(value);

  return { confirmed: text(one.confirmed) || '0', potential: text(one.potential) || '0' };
}

function asHow(value: unknown): CoverHow {
  const one = record(value);

  if (one.mode === 'percent') return { mode: 'percent', percent: text(one.percent) };
  if (one.mode === 'fixed') return { mode: 'fixed', amount: text(one.amount) };
  if (one.mode === 'rest')
    return {
      mode: 'rest',
      after: list(one.after).map((each) => {
        const part = record(each);

        return { payerId: text(part.payerId), amount: text(part.amount) };
      }),
    };

  return { mode: 'one' };
}

function asCover(value: unknown): PayerCover {
  const one = record(value);

  return {
    lineId: text(one.lineId),
    label: text(one.label),
    notPriced: one.notPriced === true,
    part: asPair(one.part),
    how: asHow(one.how),
  };
}

export function asPayer(value: unknown): Payer {
  const one = record(value);

  return {
    id: text(one.id),
    name: text(one.name),
    note: typeof one.note === 'string' && one.note !== '' ? one.note : null,
    share: asPair(one.share),
    notPriced: whole(one.notPriced),
    paid: typeof one.paid === 'string' ? one.paid : null,
    stillToCome: one.stillToCome == null ? null : asPair(one.stillToCome),
    covers: list(one.covers).map(asCover),
  };
}

function asSplit(value: unknown): PayerSplit | null {
  const one = record(value);

  if (one.mode === 'one') return { mode: 'one', payerId: text(one.payerId) };
  if (one.mode === 'percent')
    return {
      mode: 'percent',
      shares: list(one.shares).map((each) => {
        const part = record(each);

        return { payerId: text(part.payerId), percent: text(part.percent) };
      }),
    };
  if (one.mode === 'fixed')
    return {
      mode: 'fixed',
      amounts: list(one.amounts).map((each) => {
        const part = record(each);

        return { payerId: text(part.payerId), amount: text(part.amount) };
      }),
      restId: text(one.restId),
    };

  return null;
}

function asLine(value: unknown): PayerLine | null {
  const one = record(value);
  const category = VENDOR_CATEGORIES.find((each) => each === one.category);
  if (typeof one.id !== 'string' || category == null) return null;

  return {
    id: one.id,
    label: text(one.label),
    category,
    cost: asPair(one.cost),
    notPriced: one.notPriced === true,
    flagged: one.flagged === true,
    split: asSplit(one.split),
  };
}

export function asEventPayers(value: unknown): EventPayers {
  const body = record(value);
  const none = record(body.noPayer);
  const next = record(body.next);

  return {
    currency: text(body.currency),
    paidShown: body.paidShown === true,
    total: asPair(body.total),
    hasPayer: asPair(body.hasPayer),
    noPayer: { ...asPair(none), costs: whole(none.costs), paid: text(none.paid) || '0' },
    next: typeof next.id === 'string' ? { id: next.id, label: text(next.label) } : null,
    payers: list(body.payers).map(asPayer),
    lines: list(body.lines)
      .map(asLine)
      .filter((line): line is PayerLine => line != null),
  };
}
