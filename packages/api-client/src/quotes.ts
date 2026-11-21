import { VENDOR_CATEGORIES, type VendorCategory } from './vendors.ts';

export interface QuotedVendor {
  id: string;
  name: string;
  category: VendorCategory;
  contactName: string | null;
  archived: boolean;
}

export interface QuoteVersion {
  id: string;
  covers: string;
  amount: string;
  /** A day, YYYY-MM-DD, in the event's time zone. */
  quotedOn: string;
  reference: string | null;
  supersededAt: string | null;
}

export interface PaymentPerson {
  id: string;
  name: string;
}

export interface PaymentPaid {
  amount: string;
  /** A day, YYYY-MM-DD, in the event's time zone. */
  paidOn: string;
  reference: string | null;
  at: string;
  /** Null once the person who marked it has left Soirely. */
  by: PaymentPerson | null;
  /** Paid less scheduled: shown, never absorbed. */
  difference: string;
}

export interface PaymentCancelled {
  at: string;
  by: PaymentPerson | null;
  reason: string | null;
}

export interface ScheduledPayment {
  id: string;
  description: string;
  amount: string;
  dueOn: string;
  overdue: boolean;
  /** Added as a payment already made: Undo deletes it. */
  addedAsPaid: boolean;
  paid: PaymentPaid | null;
  cancelled: PaymentCancelled | null;
}

export interface EventQuote {
  /** The vendor's engagement on this event: the id every quote and payment route takes. */
  id: string;
  vendor: QuotedVendor;
  quote: QuoteVersion;
  earlier: QuoteVersion[];
  lines: { id: string; label: string }[];
  payments: ScheduledPayment[];
  scheduled: string;
  /** Scheduled less quoted: below zero while part of the quote is not scheduled yet. */
  difference: string;
  paid: string;
  outstanding: string;
  cancelled: string;
}

export interface DuePayment {
  id: string;
  quoteId: string;
  vendor: string;
  description: string;
  amount: string;
  dueOn: string;
  overdue: boolean;
}

export interface EventQuotes {
  currency: string;
  timeZone: string;
  /** Whether the organisation's plan includes quotes; without it they stay readable and nothing changes. */
  entitled: boolean;
  quotes: EventQuote[];
  due: DuePayment[];
  totals: { paid: string; owed: string; overdue: string; overdueCount: number };
}

export interface OfferedVendor extends QuotedVendor {
  quoted: boolean;
}

export interface QuoteTyped {
  vendorId: string;
  covers: string;
  amount: string;
  currency: string;
  quotedOn: string;
  reference: string;
  lineIds: string[];
}

export type QuoteTermsTyped = Pick<QuoteTyped, 'amount' | 'currency' | 'quotedOn'>;
export type QuoteWordingTyped = Pick<QuoteTyped, 'covers' | 'reference' | 'lineIds'>;

export interface PaymentTyped {
  description: string;
  amount: string;
  currency: string;
  dueOn: string;
}

export interface PaidTyped {
  amount: string;
  currency: string;
  paidOn: string;
  reference: string;
}

export interface MadeTyped extends PaidTyped {
  description: string;
}

type Row = Record<string, unknown>;

const record = (value: unknown): Row =>
  value != null && typeof value === 'object' ? (value as Row) : {};
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const maybe = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const category = (value: unknown): VendorCategory =>
  VENDOR_CATEGORIES.includes(value as VendorCategory) ? (value as VendorCategory) : 'other';

export function asQuotedVendor(value: unknown): QuotedVendor {
  const row = record(value);

  return {
    id: text(row.id),
    name: text(row.name),
    category: category(row.category),
    contactName: maybe(row.contactName),
    archived: row.archived === true,
  };
}

function asVersion(value: unknown): QuoteVersion {
  const row = record(value);

  return {
    id: text(row.id),
    covers: text(row.covers),
    amount: text(row.amount) || '0',
    quotedOn: text(row.quotedOn),
    reference: maybe(row.reference),
    supersededAt: maybe(row.supersededAt),
  };
}

function asPerson(value: unknown): PaymentPerson | null {
  const row = record(value);

  return typeof row.id === 'string' ? { id: row.id, name: text(row.name) } : null;
}

function asPaid(value: unknown): PaymentPaid | null {
  if (value == null) {
    return null;
  }

  const row = record(value);

  return {
    amount: text(row.amount) || '0',
    paidOn: text(row.paidOn),
    reference: maybe(row.reference),
    at: text(row.at),
    by: asPerson(row.by),
    difference: text(row.difference) || '0',
  };
}

function asCancelled(value: unknown): PaymentCancelled | null {
  if (value == null) {
    return null;
  }

  const row = record(value);

  return { at: text(row.at), by: asPerson(row.by), reason: maybe(row.reason) };
}

function asPayment(value: unknown): ScheduledPayment {
  const row = record(value);

  return {
    id: text(row.id),
    description: text(row.description),
    amount: text(row.amount) || '0',
    dueOn: text(row.dueOn),
    overdue: row.overdue === true,
    addedAsPaid: row.addedAsPaid === true,
    paid: asPaid(row.paid),
    cancelled: asCancelled(row.cancelled),
  };
}

export function asEventQuote(value: unknown): EventQuote {
  const row = record(value);

  return {
    id: text(row.id),
    vendor: asQuotedVendor(row.vendor),
    quote: asVersion(row.quote),
    earlier: list(row.earlier).map(asVersion),
    lines: list(row.lines).map((one) => ({
      id: text(record(one).id),
      label: text(record(one).label),
    })),
    payments: list(row.payments).map(asPayment),
    scheduled: text(row.scheduled) || '0',
    difference: text(row.difference) || '0',
    paid: text(row.paid) || '0',
    outstanding: text(row.outstanding) || '0',
    cancelled: text(row.cancelled) || '0',
  };
}

export function asEventQuotes(value: unknown): EventQuotes {
  const body = record(value);

  return {
    currency: text(body.currency),
    timeZone: text(body.timeZone),
    entitled: body.entitled === true,
    quotes: list(body.quotes).map(asEventQuote),
    due: list(body.due).map((one) => {
      const row = record(one);

      return {
        id: text(row.id),
        quoteId: text(row.quoteId),
        vendor: text(row.vendor),
        description: text(row.description),
        amount: text(row.amount) || '0',
        dueOn: text(row.dueOn),
        overdue: row.overdue === true,
      };
    }),
    totals: {
      paid: text(record(body.totals).paid) || '0',
      owed: text(record(body.totals).owed) || '0',
      overdue: text(record(body.totals).overdue) || '0',
      overdueCount: Number(record(body.totals).overdueCount) || 0,
    },
  };
}

export function asOfferedVendors(value: unknown): OfferedVendor[] {
  return list(record(value).vendors).map((one) => ({
    ...asQuotedVendor(one),
    quoted: record(one).quoted === true,
  }));
}

/** The events a vendor still has unpaid payments on, from the 409 `vendor_owed` that refuses archiving it. */
export function owingEvents(problem: unknown): { id: string; name: string }[] {
  return list(record(problem).events).map((one) => ({
    id: text(record(one).id),
    name: text(record(one).name),
  }));
}
