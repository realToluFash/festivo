import {
  BUDGET_EVENT,
  COST_LINES,
  CURRENCY,
  LOCALE,
  PAYMENTS,
  QUOTES,
  READER,
  TODAY,
  type Payment,
  type QuoteVersion,
  dueList,
  money,
  overdue,
  owed,
  whole,
} from './budget.ts';
import { sampleEvent } from './events.ts';
import { PW } from './paymentsWords.ts';
import { QW } from './quotesWords.ts';
import { type Vendor, inNameOrder, nameMatches, sampleVendors } from './vendors.ts';
import { CATEGORY_WORDS } from './vendorsWords.ts';

export type BudgetViewerKey = 'folake' | 'julien' | 'ana';

export interface BudgetViewer {
  key: BudgetViewerKey;
  name: string;
  role: 'Owner' | 'Admin' | 'Lead';
  readsVendors: boolean;
  managesBilling: boolean;
}

export const BUDGET_VIEWERS: Record<BudgetViewerKey, BudgetViewer> = {
  folake: {
    key: 'folake',
    name: READER,
    role: 'Owner',
    readsVendors: true,
    managesBilling: true,
  },
  julien: {
    key: 'julien',
    name: 'Julien Moreau',
    role: 'Admin',
    readsVendors: true,
    managesBilling: false,
  },
  ana: { key: 'ana', name: 'Ana Souza', role: 'Lead', readsVendors: false, managesBilling: false },
};

export function budgetViewerOf(as: string | null, state = ''): BudgetViewer {
  if (state === 'lead') return BUDGET_VIEWERS.ana;

  return Object.values(BUDGET_VIEWERS).find((one) => one.key === as) ?? BUDGET_VIEWERS.folake;
}

/** What a quote shows of a vendor: its name, its category and its contact name, and nothing else (7 Nov). */
export interface QuotedVendor {
  id: string;
  name: string;
  category: string;
  contact: string;
}

export function quotedVendorOf(vendor: Vendor): QuotedVendor {
  return {
    id: vendor.id,
    name: vendor.name,
    category: CATEGORY_WORDS[vendor.category],
    contact: vendor.contact,
  };
}

export interface Quote {
  vendor: QuotedVendor;
  covers: string;
  amount: number;
  quotedOn: string;
  number: string;
  lines: readonly string[];
  earlier: readonly QuoteVersion[];
}

export interface Budget {
  quotes: Quote[];
  payments: Payment[];
}

export interface Owing {
  id: string;
  name: string;
}

export { CURRENCY, TODAY };

export function sampleBudget(vendors: readonly Vendor[] = sampleVendors()): Budget {
  return {
    quotes: QUOTES.map((one) => {
      const vendor = vendors.find((each) => each.id === one.vendorId);
      if (vendor == null) throw new Error(`No sample vendor ${one.vendorId}`);

      return {
        vendor: quotedVendorOf(vendor),
        covers: one.covers,
        amount: one.amount,
        quotedOn: one.quotedOn,
        number: one.number ?? '',
        lines: one.lineIds,
        earlier: one.earlier == null ? [] : [one.earlier],
      };
    }),
    payments: PAYMENTS.map((one) => ({ ...one })),
  };
}

export function lineName(id: string): string {
  return COST_LINES.find((one) => one.id === id)?.name ?? id;
}

const LIST = new Intl.ListFormat(LOCALE, { type: 'conjunction' });

export function linesWords(ids: readonly string[]): string {
  return ids.length === 0 ? QW.noLines : LIST.format(ids.map(lineName));
}

export function minorDigits(currency: string): number {
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

export type Typed = { minor: number } | { wrong: 'blank' | 'negative' | 'number' | 'decimals' };

/** The demo's one parser of a typed amount, in English: digits, optional grouping commas, a point, at most the currency's minor digits. */
export function typedMinor(typed: string, currency = CURRENCY): Typed {
  const plain = typed.trim().replace(/\s/g, '');
  if (plain === '') return { wrong: 'blank' };
  if (/^[-−]/.test(plain)) return { wrong: 'negative' };
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(plain)) return { wrong: 'number' };
  const [whole = '', fraction = ''] = plain.replace(/,/g, '').split('.');
  const digits = minorDigits(currency);
  if (fraction.length > digits) return { wrong: 'decimals' };

  return { minor: Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || '0') };
}

export function parsedAmount(typed: string, currency = CURRENCY): number | null {
  const found = typedMinor(typed, currency);

  return 'minor' in found && found.minor > 0 ? found.minor : null;
}

export function exampleIn(whole: number, currency = CURRENCY): string {
  const digits = minorDigits(currency);

  return new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(digits === 0 ? whole : whole + 0.5);
}

export function typedAmount(minor: number, currency = CURRENCY): string {
  const digits = minorDigits(currency);

  return new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 10 ** digits);
}

/** sc-88's shared amount key: one example at the currency's minor unit, never a decimal count in words. */
export function amountProblem(currency = CURRENCY): string {
  const digits = minorDigits(currency);
  const example = new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(digits === 0 ? 3500 : 3500.5);

  return QW.enterAmount(example);
}

export function lengthOf(typed: string): number {
  return [...typed.trim()].length;
}

export const QUOTE_LIMITS = { covers: 500, number: 64, what: 100, reference: 100 } as const;

export type QuoteForm = 'add' | 'revise' | 'correct';

export interface QuoteDraft {
  vendorId: string;
  typed: string;
  covers: string;
  amount: string;
  quotedOn: string;
  number: string;
  lines: readonly string[];
}

export type QuoteField = 'vendor' | 'covers' | 'amount' | 'quotedOn' | 'number';
export type QuoteProblems = Partial<Record<QuoteField, string>>;

export const BLANK_QUOTE: QuoteDraft = {
  vendorId: '',
  typed: '',
  covers: '',
  amount: '',
  quotedOn: '',
  number: '',
  lines: [],
};

export function draftOfQuote(quote: Quote): QuoteDraft {
  return {
    vendorId: quote.vendor.id,
    typed: quote.vendor.name,
    covers: quote.covers,
    amount: typedAmount(quote.amount),
    quotedOn: quote.quotedOn,
    number: quote.number,
    lines: quote.lines,
  };
}

export const REVISE_UNCHANGED = QW.reviseUnchanged;

export function quoteProblems(
  draft: QuoteDraft,
  form: QuoteForm,
  today: string,
  current?: Quote,
): QuoteProblems {
  const problems: QuoteProblems = {};

  if (form === 'add' && draft.vendorId === '') problems.vendor = QW.chooseTheVendor;

  if (form !== 'revise') {
    if (draft.covers.trim() === '') problems.covers = QW.enterCovers;
    else if (lengthOf(draft.covers) > QUOTE_LIMITS.covers)
      problems.covers = QW.coversTooLong(QUOTE_LIMITS.covers);
    if (lengthOf(draft.number) > QUOTE_LIMITS.number)
      problems.number = QW.numberTooLong(QUOTE_LIMITS.number);
  }

  if (form !== 'correct') {
    const amount = parsedAmount(draft.amount);
    if (amount == null) problems.amount = amountProblem();
    if (draft.quotedOn === '') problems.quotedOn = QW.enterDateQuoted;
    else if (draft.quotedOn > today) problems.quotedOn = QW.quotedAhead;
    if (
      form === 'revise' &&
      current != null &&
      problems.amount == null &&
      problems.quotedOn == null &&
      amount === current.amount &&
      draft.quotedOn === current.quotedOn
    ) {
      problems.amount = REVISE_UNCHANGED;
      problems.quotedOn = REVISE_UNCHANGED;
    }
  }

  return problems;
}

export function offered(vendors: readonly Vendor[], typed: string): Vendor[] {
  return inNameOrder(
    vendors.filter((one) => one.archivedOn == null && nameMatches(one.name, typed)),
  );
}

export function anyToOffer(vendors: readonly Vendor[]): boolean {
  return vendors.some((one) => one.archivedOn == null);
}

export function agreedElsewhere(budget: Budget, lineId: string, vendorId: string): Quote | null {
  return (
    budget.quotes.find((one) => one.vendor.id !== vendorId && one.lines.includes(lineId)) ?? null
  );
}

export function linesToSave(budget: Budget, vendorId: string, lines: readonly string[]): string[] {
  return lines.filter((id) => agreedElsewhere(budget, id, vendorId) == null);
}

export function scheduledFor(budget: Budget, vendorId: string): Payment[] {
  return budget.payments
    .filter((one) => one.vendorId === vendorId && one.cancelled == null)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.id.localeCompare(b.id));
}

export function nextPaymentId(payments: readonly Payment[]): string {
  const highest = payments.reduce((top, one) => Math.max(top, Number(one.id.slice(1)) || 0), 0);

  return `p${highest + 1}`;
}

/** The other events' quotes and unpaid payments, which have no budget in the demo: the wedding's come from sampleBudget(). */
const ENGAGED_ELSEWHERE: Readonly<Record<string, number>> = { v1: 1, v3: 1, v4: 3, v6: 2, v7: 1 };
const OWED_ELSEWHERE: Readonly<Record<string, readonly string[]>> = { v3: ['evt-ireti-2'] };

const owing = (id: string): Owing => ({ id, name: sampleEvent(id)?.name ?? id });

export function usedOn(vendorId: string, wedding: Budget = sampleBudget()): string | null {
  const here = wedding.quotes.some((one) => one.vendor.id === vendorId) ? 1 : 0;
  const count = here + (ENGAGED_ELSEWHERE[vendorId] ?? 0);
  return count === 0 ? null : QW.usedOn(count);
}

/** The events that still have a payment to a vendor that is not paid or cancelled: archiving it is refused while any does (409). */
export function owedBy(vendorId: string, wedding: Budget = sampleBudget()): readonly Owing[] {
  const here = wedding.payments.some((one) => one.vendorId === vendorId && owed(one))
    ? [BUDGET_EVENT]
    : [];

  return [...here, ...(OWED_ELSEWHERE[vendorId] ?? [])].map(owing);
}

export function sum(payments: readonly Payment[]): number {
  return payments.reduce((total, one) => total + one.amount, 0);
}

export type Difference = 'matches' | 'short' | 'over';

export function differenceOf(quoted: number, scheduled: number): Difference {
  return scheduled === quoted ? 'matches' : scheduled < quoted ? 'short' : 'over';
}

/** A card rounds the gap to whole units, but never to £0: a gap under one unit keeps its minor unit. */
export function cardGap(minor: number): string {
  return Math.abs(minor) < 100 ? money(minor) : whole(minor);
}

export function differenceLine(
  quoted: number,
  scheduled: number,
  shown: (minor: number) => string,
): string {
  const gap = shown(Math.abs(quoted - scheduled));

  switch (differenceOf(quoted, scheduled)) {
    case 'matches':
      return QW.matches;
    case 'short':
      return QW.short(gap);
    case 'over':
      return QW.over(gap);
  }
}

export function differenceShort(
  quoted: number,
  scheduled: number,
  shown: (minor: number) => string,
): string {
  const gap = shown(Math.abs(quoted - scheduled));

  switch (differenceOf(quoted, scheduled)) {
    case 'matches':
      return QW.matchesShort;
    case 'short':
      return QW.shortShort(gap);
    case 'over':
      return QW.overShort(gap);
  }
}

export interface Due {
  payment: Payment;
  vendor: QuotedVendor;
  overdue: boolean;
}

/** Every unpaid payment on every quoted vendor: soonest first, then by vendor name; before today is Overdue. */
export function everythingDue(budget: Budget, today = TODAY): Due[] {
  const vendors = new Map(budget.quotes.map((one) => [one.vendor.id, one.vendor]));
  const named = budget.payments.filter((one) => vendors.has(one.vendorId));

  return dueList(named, (id) => vendors.get(id)?.name ?? '').flatMap((payment) => {
    const vendor = vendors.get(payment.vendorId);

    return vendor == null ? [] : [{ payment, vendor, overdue: overdue(payment, today) }];
  });
}

export function firstOverdue(budget: Budget, vendorId: string, today = TODAY): Payment | null {
  return scheduledFor(budget, vendorId).find((one) => overdue(one, today)) ?? null;
}

export interface PaymentDraft {
  what: string;
  amount: string;
  dueOn: string;
}

export type PaymentField = keyof PaymentDraft;
export type PaymentProblems = Partial<Record<PaymentField, string>>;

export const BLANK_PAYMENT: PaymentDraft = { what: '', amount: '', dueOn: '' };

export function draftOfPayment(payment: Payment): PaymentDraft {
  return { what: payment.what, amount: typedAmount(payment.amount), dueOn: payment.dueOn };
}

export function paymentProblems(
  draft: PaymentDraft,
  quote: Quote,
  dateOf: (day: string) => string,
): PaymentProblems {
  const problems: PaymentProblems = {};

  if (draft.what.trim() === '') problems.what = QW.enterWhatFor;
  else if (lengthOf(draft.what) > QUOTE_LIMITS.what)
    problems.what = QW.whatForTooLong(QUOTE_LIMITS.what);
  if (parsedAmount(draft.amount) == null) problems.amount = amountProblem();
  if (draft.dueOn === '') problems.dueOn = QW.enterDateDue;
  else if (draft.dueOn < quote.quotedOn)
    problems.dueOn = QW.dueBeforeQuote(quote.vendor.name, dateOf(quote.quotedOn));

  return problems;
}

export interface MarkDraft {
  amount: string;
  paidOn: string;
  reference: string;
}

export type MarkProblems = Partial<Record<'amount' | 'paidOn' | 'reference', string>>;

export function draftToMark(payment: Payment, today = TODAY): MarkDraft {
  return { amount: typedAmount(payment.amount), paidOn: today, reference: '' };
}

export function markProblems(draft: MarkDraft, payment: Payment): MarkProblems {
  const problems: MarkProblems = {};

  if (parsedAmount(draft.amount) == null)
    problems.amount = QW.amountPaidProblem(typedAmount(payment.amount));
  if (lengthOf(draft.reference) > QUOTE_LIMITS.reference)
    problems.reference = PW.referenceTooLong(QUOTE_LIMITS.reference);
  if (draft.paidOn === '') problems.paidOn = QW.datePaidBlank;

  return problems;
}

export function markedPaid(payment: Payment, draft: MarkDraft, by: string): Payment {
  return {
    ...payment,
    paid: {
      amount: parsedAmount(draft.amount) ?? payment.amount,
      on: draft.paidOn,
      by,
      reference: draft.reference.trim(),
    },
  };
}

export type Refusal = 'second_quote' | 'vendor_gone' | 'line_taken';

export interface Opened {
  form: QuoteForm;
  draft: QuoteDraft;
  problems: QuoteProblems;
  refusal: Refusal | null;
  list: boolean;
}

export interface PaymentOpen {
  draft: PaymentDraft;
  problems: PaymentProblems;
}

export interface Amending extends PaymentOpen {
  id: string;
}

export type MarkRefusal = 'paid' | 'cancelled';

export interface Marking {
  id: string;
  draft: MarkDraft;
  problems: MarkProblems;
  refused: MarkRefusal | null;
}

export interface QuotesStart {
  budget: Budget;
  vendors: Vendor[];
  readOnly: boolean;
  quote: Opened | null;
  payment: PaymentOpen | null;
  amending: Amending | null;
  removing: string | null;
  earlier: boolean;
}

export const SAVOUR = 'v4';
const BEAT = 'v2';
const BLOOM = 'v3';
export const TAKEN_LINE = 'arch';

/** Board 2's names, each drawn on Savour Kitchen's page: without `&vendor=` they open there. */
export const VENDOR_STATES: readonly string[] = [
  'vendor',
  'no_payments',
  'earlier',
  'lead',
  'revise',
  'revise_unchanged',
  'correct',
  'add_payment',
  'payment_refused',
  'payment_blank',
  'amend',
  'remove',
];

export const QUOTES_STATES: readonly string[] = [
  ...VENDOR_STATES,
  'no_quotes',
  'nothing_due',
  'read_only',
  'add',
  'vendor_typed',
  'vendor_none',
  'no_vendors',
  'add_filled',
  'add_blank',
  'invalid_amount',
  'future_date',
  'too_long',
  'second_quote',
  'vendor_gone',
  'line_taken',
];

export function pageVendor(state: string, vendor: string | null): string | null {
  return vendor ?? (VENDOR_STATES.includes(state) ? SAVOUR : null);
}

function opened(form: QuoteForm, draft: QuoteDraft, extra: Partial<Opened> = {}): Opened {
  return { form, draft, problems: {}, refusal: null, list: false, ...extra };
}

function paidBy(payment: Payment): Payment {
  if (!owed(payment)) return payment;
  const on = payment.dueOn < TODAY ? payment.dueOn : TODAY;

  return { ...payment, paid: { amount: payment.amount, on, by: READER, reference: '' } };
}

let kept: Budget | null = null;

export function keepBudget(budget: Budget): void {
  kept = budget;
}

export function keptBudget(): Budget | null {
  return kept;
}

export function forgetBudget(): void {
  kept = null;
}

export function quotesStart(
  state: string,
  vendorId: string | null,
  dateOf: (day: string) => string,
): QuotesStart {
  const vendors = sampleVendors();
  const full = sampleBudget(vendors);
  const start: QuotesStart = {
    budget: full,
    vendors,
    readOnly: false,
    quote: null,
    payment: null,
    amending: null,
    removing: null,
    earlier: false,
  };
  const current = full.quotes.find((one) => one.vendor.id === (vendorId ?? SAVOUR));
  const beat = vendors.find((one) => one.id === BEAT);
  const filled: QuoteDraft = {
    vendorId: beat?.id ?? '',
    typed: beat?.name ?? '',
    covers: 'DJ for Friday and Saturday, with sound',
    amount: '1,250.00',
    quotedOn: '2026-11-02',
    number: 'BC-118',
    lines: ['dj'],
  };
  const checked = (draft: QuoteDraft): QuotesStart => ({
    ...start,
    quote: opened('add', draft, { problems: quoteProblems(draft, 'add', TODAY) }),
  });
  const lastOwed =
    current == null ? undefined : scheduledFor(full, current.vendor.id).filter(owed).at(-1);

  switch (state) {
    case 'no_quotes':
    case 'early_on':
      return { ...start, budget: { quotes: [], payments: [] } };
    case 'nothing_due':
      return { ...start, budget: { ...full, payments: full.payments.map(paidBy) } };
    case 'no_payments':
      return {
        ...start,
        budget: {
          ...full,
          payments: full.payments.filter((one) => one.vendorId !== (vendorId ?? SAVOUR)),
        },
      };
    case 'earlier':
      return { ...start, earlier: true };
    case 'read_only':
      return { ...start, readOnly: true };
    case 'add':
      return { ...start, quote: opened('add', BLANK_QUOTE, { list: true }) };
    case 'vendor_typed':
      return { ...start, quote: opened('add', { ...BLANK_QUOTE, typed: 'be' }, { list: true }) };
    case 'vendor_none':
      return { ...start, quote: opened('add', { ...BLANK_QUOTE, typed: 'eclat' }, { list: true }) };
    case 'no_vendors':
      return {
        ...start,
        vendors: vendors.filter((one) => one.archivedOn != null),
        quote: opened('add', BLANK_QUOTE, { list: true }),
      };
    case 'add_filled':
      return { ...start, quote: opened('add', filled) };
    case 'add_blank':
      return checked(BLANK_QUOTE);
    case 'invalid_amount':
      return checked({ ...filled, amount: '1,250.505' });
    case 'future_date':
      return checked({ ...filled, quotedOn: '2026-11-12' });
    case 'too_long':
      return checked({
        ...filled,
        covers: `${filled.covers}. `.repeat(13).trim(),
        number: 'BC-'.repeat(22),
      });
    case 'second_quote':
    case 'vendor_gone':
      return { ...start, quote: opened('add', filled, { refusal: state }) };
    case 'line_taken':
      return {
        ...start,
        budget: {
          ...full,
          quotes: full.quotes.map((one) =>
            one.vendor.id === BLOOM ? { ...one, lines: [...one.lines, TAKEN_LINE] } : one,
          ),
        },
        quote: opened('add', { ...filled, lines: ['dj', TAKEN_LINE] }, { refusal: 'line_taken' }),
      };
    case 'revise':
      return current == null
        ? start
        : {
            ...start,
            quote: opened('revise', {
              ...draftOfQuote(current),
              amount: '9,400.00',
              quotedOn: '2026-11-02',
            }),
          };
    case 'revise_unchanged':
      return current == null
        ? start
        : {
            ...start,
            quote: opened('revise', draftOfQuote(current), {
              problems: quoteProblems(draftOfQuote(current), 'revise', TODAY, current),
            }),
          };
    case 'correct':
      return current == null
        ? start
        : { ...start, quote: opened('correct', draftOfQuote(current)) };
    case 'add_payment':
      return { ...start, payment: { draft: BLANK_PAYMENT, problems: {} } };
    case 'payment_blank':
    case 'payment_refused': {
      const draft: PaymentDraft =
        state === 'payment_blank'
          ? BLANK_PAYMENT
          : { what: '', amount: '1,000.00', dueOn: '2026-10-12' };

      return current == null
        ? start
        : { ...start, payment: { draft, problems: paymentProblems(draft, current, dateOf) } };
    }
    case 'amend':
      return lastOwed == null
        ? start
        : {
            ...start,
            amending: {
              id: lastOwed.id,
              draft: { ...draftOfPayment(lastOwed), amount: '3,500.00' },
              problems: {},
            },
          };
    case 'remove':
      return { ...start, removing: lastOwed?.id ?? null };
    default:
      return start;
  }
}

export const DUE_NEXT = 3;

export interface BudgetAddresses {
  home: string;
  due: string;
  vendor: (id: string) => string;
}

export function budgetAt(event: string, viewer: BudgetViewer, readOnly = false): BudgetAddresses {
  const as = `${viewer.key === 'folake' ? '' : `&as=${viewer.key}`}${readOnly ? '&state=read_only' : ''}`;

  return {
    home: `/demo/events/${event}?area=budget${as}`,
    due: `/demo/events/${event}?area=budget&view=due${as}`,
    vendor: (id: string) => `/demo/events/${event}?area=budget&vendor=${id}${as}`,
  };
}

export function directoryAt(vendorId: string | null, as: BudgetViewerKey): string {
  const query = new URLSearchParams();
  if (vendorId != null) {
    query.set('state', 'from_event');
    query.set('vendor', vendorId);
  }
  if (as !== 'folake') query.set('as', as);
  const search = query.toString();

  return `/demo/settings/vendors${search === '' ? '' : `?${search}`}`;
}

export interface DemoLink {
  to: string;
  name: string;
}

const at = (state?: string, vendor?: string, as?: string): string => {
  const query = new URLSearchParams({ area: 'budget' });
  if (vendor != null) query.set('vendor', vendor);
  if (state != null) query.set('state', state);
  if (as != null) query.set('as', as);

  return `/demo/events/${BUDGET_EVENT}?${query.toString()}`;
};

export const QUOTES_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'On Budget, and a vendor’s page',
    states: [
      { to: at(), name: 'Budget: Due next and Vendors quoted' },
      { to: `${at()}&view=due`, name: 'Everything due · 5, the whole list' },
      { to: at('no_quotes'), name: 'No quotes yet (no_quotes)' },
      { to: at('nothing_due'), name: 'Quotes, and nothing is due (nothing_due)' },
      { to: at('vendor', SAVOUR), name: 'Savour Kitchen, £1,500.00 not scheduled (vendor)' },
      { to: at(undefined, BLOOM), name: 'Bloom & Co, the balance overdue, with Mark paid' },
      { to: at('no_payments', SAVOUR), name: 'No payments scheduled yet (no_payments)' },
      { to: at('earlier', SAVOUR), name: 'The earlier quote, shown (earlier)' },
      { to: at('lead', SAVOUR), name: 'The event’s Lead: the name is plain (lead)' },
    ],
  },
  {
    name: 'Read only, and Add a quote',
    states: [
      { to: at('read_only', SAVOUR), name: 'After a downgrade, read only (read_only)' },
      { to: at('read_only'), name: 'Budget, read only' },
      { to: at('add'), name: 'Add a quote, the vendors offered (add)' },
      { to: at('vendor_typed'), name: '“be” typed (vendor_typed)' },
      { to: at('vendor_none'), name: 'No match, for an owner or admin (vendor_none)' },
      { to: at('vendor_none', undefined, 'ana'), name: 'No match, for the Lead (vendor_none)' },
    ],
  },
  {
    name: 'Filling it in',
    states: [
      { to: at('no_vendors'), name: 'No vendors to choose from (no_vendors)' },
      { to: at('add_filled'), name: 'Beat Collective for the DJ (add_filled)' },
      { to: at('add_blank'), name: 'Each required field marked (add_blank)' },
      { to: at('invalid_amount'), name: 'Too many decimals (invalid_amount)' },
      { to: at('future_date'), name: 'A date ahead (future_date)' },
      { to: at('too_long'), name: 'Over 500 and 64 characters (too_long)' },
    ],
  },
  {
    name: 'Refused, revised, corrected',
    states: [
      { to: at('second_quote'), name: 'Quoted by someone else meanwhile (second_quote)' },
      { to: at('vendor_gone'), name: 'The vendor archived meanwhile (vendor_gone)' },
      { to: at('line_taken'), name: 'A line agreed meanwhile (line_taken)' },
      { to: at('revise', SAVOUR), name: 'Revise the quote (revise)' },
      { to: at('revise_unchanged', SAVOUR), name: 'Nothing to revise (revise_unchanged)' },
      { to: at('correct', SAVOUR), name: 'Correct the quote (correct)' },
    ],
  },
  {
    name: 'Payments',
    states: [
      { to: at('add_payment', SAVOUR), name: 'Add a payment (add_payment)' },
      {
        to: at('payment_refused', SAVOUR),
        name: 'Blank, and due before the quote (payment_refused)',
      },
      { to: at('payment_blank', SAVOUR), name: 'Sent blank (payment_blank)' },
      { to: at('amend', SAVOUR), name: 'Change a payment, in place (amend)' },
      { to: at('remove', SAVOUR), name: 'Remove, asked in the row (remove)' },
    ],
  },
];
