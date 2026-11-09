import { readerTag } from './guest.ts';
import { type Category } from './vendors.ts';
import { CATEGORY_WORDS } from './vendorsWords.ts';

/** Budget A's sample (budget-a-spec.md §1): the wedding as Guests A counts it, in pounds, read on Tue, Nov 3 at 09:41 London time. */
export const BUDGET_EVENT = 'evt-wed-4';
export const CURRENCY = 'GBP';
export const LOCALE = readerTag('en');
export const TODAY = '2026-11-03';
export const NOW = new Date('2026-11-03T09:41:00Z');
export const READER = 'Folake Adeyemi';

export const HEADS = { invited: 142, coming: 96, notComing: 9, stillToAnswer: 37, ifAllCome: 133 };
export const DAYS = 3;
export const TABLES = 0;

export type Basis = 'perHead' | 'perTable' | 'perStaffHour' | 'perDay' | 'fixed';

export interface CostLine {
  id: string;
  name: string;
  category: Category;
  basis: Basis;
  rate: number | null;
}

export const COST_LINES: readonly CostLine[] = [
  { id: 'dinner', name: 'Dinner', category: 'catering', basis: 'perHead', rate: 6800 },
  { id: 'drinks', name: 'Drinks package', category: 'catering', basis: 'perHead', rate: 2200 },
  { id: 'room', name: 'Room hire', category: 'venue', basis: 'perDay', rate: 210000 },
  { id: 'bridal', name: 'Bridal flowers', category: 'flowers', basis: 'fixed', rate: 85000 },
  { id: 'centre', name: 'Centrepieces', category: 'flowers', basis: 'perTable', rate: 4500 },
  { id: 'arch', name: 'Aisle arch', category: 'flowers', basis: 'fixed', rate: null },
  { id: 'photo', name: 'Photographer', category: 'photography', basis: 'fixed', rate: 240000 },
  { id: 'dj', name: 'DJ', category: 'music', basis: 'fixed', rate: 90000 },
  { id: 'cars', name: 'Cars', category: 'transport', basis: 'fixed', rate: 64000 },
  { id: 'shuttle', name: 'Guest shuttle', category: 'transport', basis: 'fixed', rate: null },
];

export type LineState = 'priced' | 'notPriced' | 'nothingYet';

export function lineState(line: CostLine): LineState {
  if (line.rate == null) return 'notPriced';
  if (line.basis === 'perTable' && TABLES === 0) return 'nothingYet';

  return 'priced';
}

export function quantities(line: CostLine): { settled: number; ifAll: number } {
  switch (line.basis) {
    case 'perHead':
      return { settled: HEADS.coming, ifAll: HEADS.ifAllCome };
    case 'perTable':
      return { settled: TABLES, ifAll: TABLES };
    case 'perDay':
      return { settled: DAYS, ifAll: DAYS };
    case 'perStaffHour':
      return { settled: 0, ifAll: 0 };
    default:
      return { settled: 1, ifAll: 1 };
  }
}

export function amounts(line: CostLine): { settled: number; ifAll: number } {
  if (lineState(line) !== 'priced' || line.rate == null) return { settled: 0, ifAll: 0 };
  const q = quantities(line);

  return { settled: line.rate * q.settled, ifAll: line.rate * q.ifAll };
}

export interface Totals {
  settled: number;
  ifAll: number;
  notPriced: number;
}

export function totals(lines: readonly CostLine[] = COST_LINES): Totals {
  return lines.reduce(
    (sum, line) => {
      const each = amounts(line);

      return {
        settled: sum.settled + each.settled,
        ifAll: sum.ifAll + each.ifAll,
        notPriced: sum.notPriced + (lineState(line) === 'notPriced' ? 1 : 0),
      };
    },
    { settled: 0, ifAll: 0, notPriced: 0 },
  );
}

/** Per head in the minor unit, or null while nobody has said yes (never £0). */
export function perHead(lines: readonly CostLine[] = COST_LINES): {
  settled: number | null;
  ifAll: number | null;
} {
  const sum = totals(lines);

  return {
    settled: HEADS.coming === 0 ? null : Math.round(sum.settled / HEADS.coming),
    ifAll: HEADS.ifAllCome === 0 ? null : Math.round(sum.ifAll / HEADS.ifAllCome),
  };
}

export function categoriesOf(lines: readonly CostLine[] = COST_LINES): Category[] {
  const order = Object.keys(CATEGORY_WORDS) as Category[];

  return order.filter((category) => lines.some((line) => line.category === category));
}

const minus = (text: string): string => text.replace('-', '−');

/** A row's, a field's or a payment's amount, in the minor unit, so the rows add up exactly (pm, 7 Nov 2026). */
export function money(minor: number, currency = CURRENCY, locale = LOCALE): string {
  return minus(new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100));
}

/** A summary card's figure, in whole units. */
export function whole(minor: number, currency = CURRENCY, locale = LOCALE): string {
  return minus(
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(minor / 100),
  );
}

export function moneyRange(low: number, high: number): string {
  return low === high ? money(low) : `${money(low)} to ${money(high)}`;
}

export function wholeRange(low: number, high: number): string {
  return low === high ? whole(low) : `${whole(low)} to ${whole(high)}`;
}

export function shortDay(day: string, locale = LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}

export function longDay(day: string, locale = LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}

const BASIS_UNIT: Record<Basis, string> = {
  perHead: 'a head',
  perTable: 'a table',
  perStaffHour: 'an hour',
  perDay: 'a day',
  fixed: '',
};

export function rateWords(line: CostLine): string | null {
  if (line.rate == null) return null;
  const unit = BASIS_UNIT[line.basis];

  return unit === '' ? money(line.rate) : `${money(line.rate)} ${unit}`;
}

const SOURCE: Record<Basis, string> = {
  perHead: 'said yes, from the guest list',
  perTable: 'No seating plan yet',
  perStaffHour: 'from Staff rates',
  perDay: 'days the event runs',
  fixed: 'a fixed amount',
};

/** A cost row's line: its rate × the count and where the count comes from (sc-85). */
export function costLine(line: CostLine): string {
  switch (lineState(line)) {
    case 'notPriced':
      return 'No price yet';
    case 'nothingYet':
      return `${rateWords(line) ?? ''} · Nothing yet · ${SOURCE[line.basis]}`;
    default:
      return line.basis === 'fixed'
        ? 'A fixed amount'
        : `${rateWords(line) ?? ''} × ${quantities(line).settled} · ${SOURCE[line.basis]}`;
  }
}

export interface QuoteVersion {
  amount: number;
  quotedOn: string;
  number: string | null;
}

export interface EventQuote extends QuoteVersion {
  vendorId: string;
  covers: string;
  lineIds: readonly string[];
  earlier: QuoteVersion | null;
}

export const QUOTES: readonly EventQuote[] = [
  {
    vendorId: 'v4',
    amount: 900000,
    quotedOn: '2026-10-13',
    number: 'SK-0412',
    covers: 'Dinner and a drinks package, for up to 130 guests',
    lineIds: ['dinner', 'drinks'],
    earlier: { amount: 840000, quotedOn: '2026-09-21', number: 'SK-0398' },
  },
  {
    vendorId: 'v5',
    amount: 630000,
    quotedOn: '2026-09-01',
    number: 'LM-2026-118',
    covers: 'The ballroom from Thursday to Saturday',
    lineIds: ['room'],
    earlier: null,
  },
  {
    vendorId: 'v6',
    amount: 240000,
    quotedOn: '2026-10-01',
    number: null,
    covers: 'Both days, edited photographs within 6 weeks',
    lineIds: ['photo'],
    earlier: null,
  },
  {
    vendorId: 'v3',
    amount: 120000,
    quotedOn: '2026-10-06',
    number: 'BC-2291',
    covers: 'Bridal flowers and 14 centrepieces',
    lineIds: ['bridal', 'centre'],
    earlier: null,
  },
];

export interface Paid {
  amount: number;
  on: string;
  by: string;
  reference: string;
}

export interface Payment {
  id: string;
  vendorId: string;
  what: string;
  amount: number;
  dueOn: string;
  paid: Paid | null;
  cancelled: { why: string } | null;
}

export const PAYMENTS: readonly Payment[] = [
  pay('p1', 'v5', 'Deposit', 315000, '2026-09-01', '2026-09-01'),
  pay('p2', 'v5', 'Balance', 315000, '2026-11-05'),
  pay('p3', 'v6', 'Deposit', 80000, '2026-10-01', '2026-10-01'),
  pay('p4', 'v6', 'Balance', 160000, '2026-11-30'),
  pay('p5', 'v3', 'Deposit', 36000, '2026-10-06', '2026-10-06'),
  pay('p6', 'v3', 'Balance', 84000, '2026-10-30'),
  pay('p7', 'v4', 'Deposit', 450000, '2026-11-04'),
  pay('p8', 'v4', 'Second instalment', 300000, '2026-11-09'),
];

function pay(
  id: string,
  vendorId: string,
  what: string,
  amount: number,
  dueOn: string,
  paidOn?: string,
): Payment {
  return {
    id,
    vendorId,
    what,
    amount,
    dueOn,
    paid: paidOn == null ? null : { amount, on: paidOn, by: READER, reference: '' },
    cancelled: null,
  };
}

export function owed(payment: Payment): boolean {
  return payment.paid == null && payment.cancelled == null;
}

/** Overdue when due before today in the event's time zone (sc-87). */
export function overdue(payment: Payment, today = TODAY): boolean {
  return owed(payment) && payment.dueOn < today;
}

export function dueList(
  payments: readonly Payment[],
  vendorName: (id: string) => string,
): Payment[] {
  return payments
    .filter(owed)
    .sort(
      (a, b) =>
        a.dueOn.localeCompare(b.dueOn) ||
        vendorName(a.vendorId).localeCompare(vendorName(b.vendorId)),
    );
}

export function sumOf(payments: readonly Payment[], pick: (one: Payment) => number): number {
  return payments.reduce((sum, one) => sum + pick(one), 0);
}

/** Against plan's four figures (sc-89), never merged into one actual. */
export function plan(
  lines: readonly CostLine[] = COST_LINES,
  quotes: readonly EventQuote[] = QUOTES,
  payments: readonly Payment[] = PAYMENTS,
): { planned: number; committed: number; paid: number; stillToPay: number } {
  return {
    planned: totals(lines).settled,
    committed: quotes.reduce((sum, one) => sum + one.amount, 0),
    paid: sumOf(
      payments.filter((one) => one.paid != null),
      (one) => one.paid?.amount ?? 0,
    ),
    stillToPay: sumOf(payments.filter(owed), (one) => one.amount),
  };
}
