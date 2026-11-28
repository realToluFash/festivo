import { emailProblem } from '@soirely/domain';

import { type Currency, money } from './billing.ts';
import type { DemoLink } from './settings.ts';

/** sc-613: an organisation on an Enterprise contract, paid by Paddle's invoice. Dates are days in the organisation's time zone. */
export const CONTRACT_STATES = [
  'paid',
  'due',
  'overdue',
  'overdue_one',
  'two_overdue',
  'read_only',
  'ending',
] as const;

export type ContractState = (typeof CONTRACT_STATES)[number];

export function contractStateOf(raw: string | null): ContractState {
  return CONTRACT_STATES.find((state) => state === raw) ?? 'paid';
}

export type InvoiceStatus = 'paid' | 'due' | 'past_due';

export interface Invoice {
  id: string;
  number: string;
  issued: string;
  due: string;
  /** What is still owed, as Paddle reports it. */
  owed: number;
  total: number;
  status: InvoiceStatus;
}

export interface Contract {
  organisation: string;
  currency: Currency;
  start: string;
  end: string;
  pricePerYear: number;
  terms: PaymentTerms;
  purchaseOrder: string | null;
  contacts: readonly string[];
}

export const CONTRACT: Contract = {
  organisation: 'Ire Events',
  currency: 'USD',
  start: '2026-10-01',
  end: '2027-09-30',
  pricePerYear: 2490,
  terms: 'net_30',
  purchaseOrder: 'PO-2026-0412',
  contacts: ['finance@ire.events', 'folake@ire.events'],
};

const LAST_TERM: Invoice = {
  id: 'inv-1',
  number: 'inv_01-2025-0930',
  issued: '2025-09-30',
  due: '2025-10-30',
  owed: 0,
  total: 2490,
  status: 'paid',
};

const THIS_TERM: Invoice = {
  id: 'inv-2',
  number: 'inv_01-2026-0930',
  issued: '2026-09-30',
  due: '2026-10-30',
  owed: 2490,
  total: 2490,
  status: 'past_due',
};

const CHANGE: Invoice = {
  id: 'inv-3',
  number: 'inv_01-2026-1005',
  issued: '2026-10-05',
  due: '2026-11-04',
  owed: 1200,
  total: 1200,
  status: 'past_due',
};

export interface ContractStart {
  today: string;
  contract: Contract;
  invoices: readonly Invoice[];
}

export function contractStart(state: ContractState): ContractStart {
  const paid = { ...THIS_TERM, owed: 0, status: 'paid' as const };
  switch (state) {
    case 'paid':
      return { today: '2026-10-20', contract: CONTRACT, invoices: [paid, LAST_TERM] };
    case 'due':
      return {
        today: '2026-10-20',
        contract: CONTRACT,
        invoices: [{ ...THIS_TERM, status: 'due' }, LAST_TERM],
      };
    case 'overdue':
      return { today: '2026-11-01', contract: CONTRACT, invoices: [THIS_TERM, LAST_TERM] };
    case 'overdue_one':
      return { today: '2026-10-31', contract: CONTRACT, invoices: [THIS_TERM, LAST_TERM] };
    case 'two_overdue':
      return { today: '2026-11-16', contract: CONTRACT, invoices: [CHANGE, THIS_TERM, LAST_TERM] };
    case 'read_only':
      return { today: '2026-11-30', contract: CONTRACT, invoices: [THIS_TERM, LAST_TERM] };
    case 'ending':
      return { today: '2027-08-31', contract: CONTRACT, invoices: [paid, LAST_TERM] };
  }
}

const DAY_MS = 86_400_000;

function dayNumber(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
}

export function addDays(iso: string, days: number): string {
  return new Date((dayNumber(iso) + days) * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from the first day to the second, both days in the organisation's time zone. */
export function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from));
}

/** The last day before read-only: the due date plus 30 days. */
export function readOnlyDate(due: string): string {
  return addDays(due, 30);
}

export type Standing =
  | { kind: 'fine' }
  | { kind: 'overdue'; invoice: Invoice; days: number; lastDay: string }
  | { kind: 'read_only'; invoice: Invoice };

/** The oldest invoice past due sets the standing, because its date is the one that makes the organisation read-only. */
export function standingOf(invoices: readonly Invoice[], today: string): Standing {
  const oldest = invoices
    .filter((invoice) => invoice.status === 'past_due')
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  if (oldest == null) return { kind: 'fine' };
  const days = daysBetween(oldest.due, today);
  if (days < 1) return { kind: 'fine' };
  const lastDay = readOnlyDate(oldest.due);

  return days > 30
    ? { kind: 'read_only', invoice: oldest }
    : { kind: 'overdue', invoice: oldest, days, lastDay };
}

export function longDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function shortDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function owedMoney(amount: number, currency: Currency, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/** sc-613's banner, in en's words as passed on 1 Nov (#26043). */
export function bannerWords(standing: Standing, contract: Contract, locale: string): string | null {
  if (standing.kind === 'fine') return null;
  if (standing.kind === 'read_only') return CONTRACT_WORDS.readOnlyBanner;
  const amount = owedMoney(standing.invoice.owed, contract.currency, locale);
  const late =
    standing.days === 1 ? 'is 1 day overdue' : `is ${String(standing.days)} days overdue`;

  return `Your invoice for ${amount} ${late}. After ${longDay(standing.lastDay, locale)}, ${contract.organisation} becomes read-only. Live events will keep running.`;
}

export type StatusShape = 'tick' | 'ring' | 'pill';

export function statusOf(invoice: Invoice, today: string): { shape: StatusShape; word: string } {
  if (invoice.status === 'paid') return { shape: 'tick', word: 'Paid' };
  const days = daysBetween(today, invoice.due);
  if (invoice.status === 'due')
    return {
      shape: 'ring',
      word: days <= 0 ? 'Due today' : days === 1 ? 'Due in 1 day' : `Due in ${String(days)} days`,
    };
  const late = -days;

  return {
    shape: 'pill',
    word: late === 1 ? 'Past due · 1 day' : `Past due · ${String(late)} days`,
  };
}

export function endsIn(contract: Contract, today: string): number | null {
  const left = daysBetween(today, contract.end);

  return left >= 0 && left <= 30 ? left : null;
}

export function endsTitle(left: number): string {
  if (left === 0) return CONTRACT_WORDS.endsTitleToday;
  if (left === 1) return CONTRACT_WORDS.endsTitleOne;

  return CONTRACT_WORDS.endsTitle.replace('{{count}}', String(left));
}

export function endsLine(contract: Contract, locale: string): string {
  return CONTRACT_WORDS.endsLine
    .replace('{{date}}', shortDate(addDays(contract.end, 1), locale))
    .replace('{{organisation}}', contract.organisation);
}

export const PAYMENT_TERMS = ['net_15', 'net_30', 'net_45', 'net_60'] as const;

export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export const TERMS_NAMES: Record<PaymentTerms, string> = {
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
};

export const PO_LIMIT = 100;
export const PO_COUNTER_FROM = 80;

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Characters as the person sees them, so "Ìrè" is three. */
export function seenLength(text: string): number {
  return [...graphemes.segment(text)].length;
}

export function poCounter(text: string): { words: string; over: boolean } | null {
  const n = seenLength(text);
  if (n < PO_COUNTER_FROM) return null;
  const over = n - PO_LIMIT;

  return over > 0
    ? {
        words: `${String(n)} of ${String(PO_LIMIT)} characters · ${String(over)} too many`,
        over: true,
      }
    : { words: `${String(n)} of ${String(PO_LIMIT)} characters`, over: false };
}

export interface ContractForm {
  start: string;
  end: string;
  price: string;
  discount: string;
  discountReason: string;
  terms: PaymentTerms;
  purchaseOrder: string;
  contacts: readonly string[];
  reason: string;
}

export const BLANK_FORM: ContractForm = {
  start: '',
  end: '',
  price: '',
  discount: '',
  discountReason: '',
  terms: 'net_30',
  purchaseOrder: '',
  contacts: [''],
  reason: '',
};

export const FILLED_FORM: ContractForm = {
  start: '2027-10-01',
  end: '2028-09-30',
  price: '2490',
  discount: '',
  discountReason: '',
  terms: 'net_30',
  purchaseOrder: 'PO-2026-0412',
  contacts: ['finance@ire.events'],
  reason: 'Renewal signed by Folake Adeyemi on 25 August 2027.',
};

export const INVALID_FORM: ContractForm = {
  ...FILLED_FORM,
  discount: '100',
  discountReason: 'Launch partner',
  purchaseOrder: `PO-IRE-EVENTS-LAGOS-${'0'.repeat(84)}`,
};

export type FormField =
  | 'start'
  | 'end'
  | 'price'
  | 'discount'
  | 'discountReason'
  | 'purchaseOrder'
  | `contact-${string}`
  | 'reason';

export type FormErrors = Partial<Record<FormField, string>>;

export function fieldOrder(form: ContractForm): readonly FormField[] {
  return [
    'start',
    'end',
    'price',
    'discount',
    'discountReason',
    'purchaseOrder',
    ...form.contacts.map((_, index): FormField => `contact-${String(index)}`),
    'reason',
  ];
}

function amountOf(typed: string): number | null {
  const plain = typed.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/u.test(plain)) return null;

  return Number(plain);
}

export function checkContract(form: ContractForm): FormErrors {
  const errors: FormErrors = {};
  if (form.start === '') errors.start = W.startBlank;
  if (form.end === '') errors.end = W.endBlank;
  else if (form.start !== '' && form.end <= form.start) errors.end = W.endOrder;
  const price = amountOf(form.price);
  if (form.price.trim() === '') errors.price = W.priceBlank;
  else if (price == null || price <= 0) errors.price = W.priceAbove;
  if (form.discount.trim() !== '') {
    const discount = amountOf(form.discount);
    if (discount == null || discount <= 0 || discount >= 100) errors.discount = W.discountRange;
    else if (form.discountReason.trim() === '') errors.discountReason = W.discountReason;
  }
  if (seenLength(form.purchaseOrder) > PO_LIMIT) errors.purchaseOrder = W.poLong;
  const filled = form.contacts.filter((contact) => contact.trim() !== '');
  form.contacts.forEach((contact, index) => {
    const problem = emailProblem(contact);
    const key: FormField = `contact-${String(index)}`;
    if (problem === 'shape') errors[key] = W.contactShape;
    else if (problem === 'blank' && filled.length === 0 && index === 0) errors[key] = W.contactNone;
  });
  if (form.reason.trim() === '') errors.reason = W.reasonBlank;

  return errors;
}

export function priceLine(contract: Contract, locale: string): string {
  return `${money(contract.pricePerYear, contract.currency, locale)} a year`;
}

/** The board's English; `[en]` owns the words, and the developer gives each its key in the four locales. */
export const CONTRACT_WORDS = {
  title: 'Plan and billing',
  yourPlan: 'Your plan',
  enterprise: 'Enterprise',
  onContract: 'On a contract',
  term: 'Term',
  price: 'Price',
  paymentTerms: 'Payment terms',
  purchaseOrder: 'Purchase order',
  contacts: 'Billing contacts',
  talk: 'Talk to us',
  talkLine: 'To change your contract, its contacts or its purchase order, talk to us.',
  invoices: 'Invoices',
  invoicesLine: 'Invoices are issued by Paddle, our reseller. How to pay is on each invoice.',
  download: 'Download',
  readOnlyBanner: 'Read-only until the payment is made. Live events are running normally.',
  endsTitle: 'Ends in {{count}} days',
  endsTitleOne: 'Ends tomorrow',
  endsTitleToday: 'Ends today',
  endsLine: 'On {{date}}, {{organisation}} moves to the free plan. Nothing is deleted.',
  startBlank: 'Enter the date the term starts.',
  endBlank: 'Enter the date the term ends.',
  endOrder: 'Enter an end date after the start date.',
  priceBlank: 'Enter the price for the term.',
  priceAbove: 'Enter a price above 0.',
  discountRange: 'Enter a discount above 0 and below 100, or leave it empty.',
  discountReason: 'Enter the reason for the discount.',
  poLong: 'Shorten the purchase order number to 100 characters or fewer.',
  contactNone: 'Enter at least one billing contact.',
  contactShape: 'That does not look like an email address. Check it has an @ and a domain.',
  reasonBlank: 'Enter the reason for this change. It goes in the audit log.',
  paddleRefused:
    'Paddle refused the invoice: the billing account has no country for tax. Nothing was saved.',
  saved: 'Ire Events is on Enterprise from 1 October 2027. Paddle has the invoice.',
} as const;

const W = CONTRACT_WORDS;

export const contractAt = (state: ContractState, more = '') =>
  `/demo/settings/plan-and-billing/contract?state=${state}${more}`;

export const STAFF_STATES = ['blank', 'filled', 'invalid', 'refused'] as const;

export type StaffState = (typeof STAFF_STATES)[number];

export function staffStateOf(raw: string | null): StaffState {
  return STAFF_STATES.find((state) => state === raw) ?? 'blank';
}

export const EMAIL_KINDS = ['due_today', 'overdue', 'read_only', 'renewal'] as const;

export type EmailKind = (typeof EMAIL_KINDS)[number];

export function emailKindOf(raw: string | null): EmailKind {
  return EMAIL_KINDS.find((kind) => kind === raw) ?? 'due_today';
}

export interface ContractEmail {
  subject: string;
  lines: readonly string[];
  facts: readonly [string, string][];
}

export function contractEmail(kind: EmailKind, locale: string): ContractEmail {
  const amount = owedMoney(THIS_TERM.owed, CONTRACT.currency, locale);
  const facts: [string, string][] = [
    ['Amount', amount],
    ['Purchase order', CONTRACT.purchaseOrder ?? ''],
    ['Due', shortDate(THIS_TERM.due, locale)],
  ];
  const howToPay = 'How to pay by bank transfer is on the invoice, attached.';
  const live = 'Live events keep running, whatever happens to this invoice.';
  switch (kind) {
    case 'due_today':
      return {
        subject: `Your invoice for ${amount} is due today`,
        lines: [
          `The invoice for ${CONTRACT.organisation}’s Enterprise contract is due today.`,
          howToPay,
        ],
        facts,
      };
    case 'overdue':
      return {
        subject: `Your invoice for ${amount} is 7 days overdue`,
        lines: [
          `The invoice for ${CONTRACT.organisation}’s Enterprise contract is 7 days overdue.`,
          `After ${longDay(readOnlyDate(THIS_TERM.due), locale)}, ${CONTRACT.organisation} becomes read-only until it is paid. ${live}`,
          howToPay,
        ],
        facts,
      };
    case 'read_only':
      return {
        subject: `${CONTRACT.organisation} is read-only until your invoice is paid`,
        lines: [
          `The invoice for ${CONTRACT.organisation}’s Enterprise contract is 31 days overdue, so ${CONTRACT.organisation} is read-only. Nothing is deleted, and everything comes back within a minute of the payment.`,
          `Live events are running normally: guests can reply, and exports work.`,
          howToPay,
        ],
        facts,
      };
    case 'renewal':
      return {
        subject: `${CONTRACT.organisation}’s Enterprise contract ends in 30 days`,
        lines: [
          `${CONTRACT.organisation}’s Enterprise contract ends on ${shortDate(CONTRACT.end, locale)}. To renew it, reply to this email and we’ll set up the new term.`,
          `If it is not renewed, ${CONTRACT.organisation} moves to Free on that day. Nothing is deleted.`,
        ],
        facts: [
          ['Term', `${shortDate(CONTRACT.start, locale)} to ${shortDate(CONTRACT.end, locale)}`],
          ['Purchase order', CONTRACT.purchaseOrder ?? ''],
          ['Price', priceLine(CONTRACT, locale)],
        ],
      };
  }
}

const EMAIL_NAMES: Record<EmailKind, string> = {
  due_today: 'Due today, the reminder',
  overdue: 'Overdue, every 7 days',
  read_only: 'Overdue after read-only, from day 31',
  renewal: 'Renewal, 30 days before the end',
};

export const CONTRACT_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Plan and billing on a contract',
    states: [
      { to: contractAt('paid'), name: 'Paid' },
      { to: contractAt('due'), name: 'Due in 10 days' },
      { to: contractAt('overdue'), name: 'Past due · 2 days, the banner' },
      { to: contractAt('overdue', '&locale=en-US'), name: 'Past due · 2 days, in en-US' },
      { to: contractAt('overdue_one'), name: 'Past due · 1 day' },
      { to: contractAt('two_overdue'), name: 'Two invoices past due: the banner shows the oldest' },
      { to: contractAt('read_only'), name: 'Read-only after 30 days' },
      { to: contractAt('ending'), name: 'Ends in 30 days' },
      { to: contractAt('overdue', '&as=ana'), name: 'A Member: no banner' },
    ],
  },
  {
    name: 'The staff contract form (Support)',
    states: STAFF_STATES.map((state) => ({
      to: `/demo/support/contract?state=${state}`,
      name:
        state === 'blank'
          ? 'Blank, Net 30 preselected'
          : state === 'filled'
            ? 'Filled, ready to save'
            : state === 'invalid'
              ? 'Discount 100 and a PO over 100 characters'
              : 'Paddle refused it',
    })),
  },
  {
    name: 'The emails to the billing contacts',
    states: EMAIL_KINDS.map((kind) => ({
      to: `/demo/contract-email?state=${kind}`,
      name: EMAIL_NAMES[kind],
    })),
  },
];
