import { CATEGORY_WORDS, type Vendor, inNameOrder, nameMatches, sampleVendors } from './vendors.ts';

export type BudgetViewerKey = 'folake' | 'julien' | 'ana';

export interface BudgetViewer {
  key: BudgetViewerKey;
  name: string;
  role: 'Owner' | 'Admin' | 'Lead';
  readsVendors: boolean;
}

export const BUDGET_VIEWERS: Record<BudgetViewerKey, BudgetViewer> = {
  folake: { key: 'folake', name: 'Folake Adeyemi', role: 'Owner', readsVendors: true },
  julien: { key: 'julien', name: 'Julien Moreau', role: 'Admin', readsVendors: true },
  ana: { key: 'ana', name: 'Ana Souza', role: 'Lead', readsVendors: false },
};

export function budgetViewerOf(name: string | null): BudgetViewer {
  return Object.values(BUDGET_VIEWERS).find((one) => one.key === name) ?? BUDGET_VIEWERS.folake;
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

export interface BudgetLine {
  id: string;
  name: string;
}

export const LINES: readonly BudgetLine[] = [
  { id: 'l1', name: 'Dinner' },
  { id: 'l2', name: 'Drinks' },
  { id: 'l3', name: 'Centrepieces' },
  { id: 'l4', name: 'Aisle flowers' },
  { id: 'l5', name: 'String quartet' },
  { id: 'l6', name: 'Venue hire' },
  { id: 'l7', name: 'Photography' },
];

export interface Earlier {
  amount: number;
  quotedOn: string;
}

/** Amounts are in the currency's minor unit (cents for EUR), as the API holds them. */
export interface Quote {
  vendor: QuotedVendor;
  covers: string;
  amount: number;
  quotedOn: string;
  number: string;
  lines: readonly string[];
  earlier: readonly Earlier[];
}

export interface Payment {
  id: string;
  vendorId: string;
  description: string;
  amount: number;
  dueOn: string;
}

export interface Budget {
  quotes: Quote[];
  payments: Payment[];
}

export const CURRENCY = 'EUR';
/** The event's own date at the demo's clock (CLOCKS.rest), in Europe/Madrid. */
export const TODAY = '2026-11-03';

function vendorNamed(name: string): QuotedVendor {
  const vendor = sampleVendors().find((one) => one.name === name);
  if (vendor == null) throw new Error(`No sample vendor ${name}`);

  return quotedVendorOf(vendor);
}

export function sampleBudget(): Budget {
  const eclat = vendorNamed('Éclat Catering');
  const bloom = vendorNamed('Bloom & Co');
  const fola = vendorNamed('Fola Strings');
  const delta = vendorNamed('Delta Frames');

  return {
    quotes: [
      {
        vendor: eclat,
        covers: 'Dinner for 180 guests, and the drinks service from arrival to the last toast.',
        amount: 1_840_000,
        quotedOn: '2026-10-02',
        number: 'EC-2026-118',
        lines: ['l1', 'l2'],
        earlier: [{ amount: 1_920_000, quotedOn: '2026-09-12' }],
      },
      {
        vendor: bloom,
        covers: 'Eighteen table centrepieces and the aisle flowers.',
        amount: 100_000,
        quotedOn: '2026-10-20',
        number: '',
        lines: ['l3', 'l4'],
        earlier: [],
      },
      {
        vendor: fola,
        covers: 'A string quartet for the reception, three hours.',
        amount: 250_000,
        quotedOn: '2026-10-08',
        number: 'FS-0412',
        lines: ['l5'],
        earlier: [],
      },
      {
        vendor: delta,
        covers: 'Photography from arrival to the first dance, with the edited set in two weeks.',
        amount: 320_000,
        quotedOn: '2026-10-25',
        number: 'DF-77',
        lines: ['l7'],
        earlier: [],
      },
    ],
    payments: [
      {
        id: 'p1',
        vendorId: eclat.id,
        description: 'Deposit',
        amount: 552_000,
        dueOn: '2026-10-15',
      },
      {
        id: 'p2',
        vendorId: eclat.id,
        description: 'Second instalment',
        amount: 644_000,
        dueOn: '2026-11-06',
      },
      {
        id: 'p3',
        vendorId: eclat.id,
        description: 'Balance',
        amount: 644_000,
        dueOn: '2026-11-14',
      },
      { id: 'p4', vendorId: bloom.id, description: 'Deposit', amount: 40_000, dueOn: '2026-10-28' },
      { id: 'p5', vendorId: fola.id, description: 'Deposit', amount: 125_000, dueOn: '2026-11-03' },
      { id: 'p6', vendorId: fola.id, description: 'Balance', amount: 150_000, dueOn: '2026-11-14' },
    ],
  };
}

export function minorDigits(currency: string): number {
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

export function money(minor: number, currency: string, locale: string): string {
  const digits = minorDigits(currency);

  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    minor / 10 ** digits,
  );
}

/** A number as the reader types it in English: digits, optional grouping commas, a point. Null when it is not one. */
export function parsedAmount(typed: string, currency: string): number | null {
  const plain = typed.trim().replace(/\s/g, '');
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(plain)) return null;
  const [whole = '', fraction = ''] = plain.replace(/,/g, '').split('.');
  const digits = minorDigits(currency);
  if (fraction.length > digits) return null;
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || '0');

  return minor > 0 ? minor : null;
}

export function typedAmount(minor: number, currency: string): string {
  const digits = minorDigits(currency);

  return new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 10 ** digits);
}

/** sc-88's shared amount key: one example at the currency's minor unit, never a decimal count in words. */
export function amountProblem(currency: string): string {
  const digits = minorDigits(currency);
  const example = new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(digits === 0 ? 3500 : 3500.5);

  return `Enter the amount as a number above 0, like ${example}.`;
}

export function lengthOf(typed: string): number {
  return [...typed.trim()].length;
}

export const QUOTE_LIMITS = { covers: 500, number: 64, description: 100 } as const;

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
    amount: typedAmount(quote.amount, CURRENCY),
    quotedOn: quote.quotedOn,
    number: quote.number,
    lines: quote.lines,
  };
}

export const REVISE_UNCHANGED =
  'Change the amount or the date quoted to revise this quote. To change anything else, correct the quote instead.';

export function quoteProblems(
  draft: QuoteDraft,
  form: QuoteForm,
  today: string,
  current?: Quote,
): QuoteProblems {
  const problems: QuoteProblems = {};

  if (form === 'add' && draft.vendorId === '') problems.vendor = 'Choose the vendor.';

  if (form !== 'revise') {
    if (draft.covers.trim() === '') problems.covers = 'Enter what the quote covers.';
    else if (lengthOf(draft.covers) > QUOTE_LIMITS.covers)
      problems.covers = `Shorten what the quote covers to ${QUOTE_LIMITS.covers} characters or fewer.`;
    if (lengthOf(draft.number) > QUOTE_LIMITS.number)
      problems.number = `Shorten the quote number to ${QUOTE_LIMITS.number} characters or fewer.`;
  }

  if (form !== 'correct') {
    const amount = parsedAmount(draft.amount, CURRENCY);
    if (amount == null) problems.amount = amountProblem(CURRENCY);
    if (draft.quotedOn === '') problems.quotedOn = 'Enter the date quoted.';
    else if (draft.quotedOn > today)
      problems.quotedOn =
        'The date quoted cannot be in the future. Choose today or an earlier date.';
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

export const ALREADY_QUOTED = 'Already quoted on this event';
export const NO_VENDORS = 'There are no vendors to choose from.';
export const ADD_ON_VENDORS = 'Add the vendor on the Vendors page first.';
export const ASK_TO_ADD = 'Ask an owner or admin to add the vendor.';
export const DUPLICATE =
  'That vendor already has a quote on this event, so this quote was not saved. To give a new price, revise that quote.';
export const VENDOR_GONE =
  'That vendor is no longer one of this organisation’s vendors, so the quote was not saved.';
export const READ_ONLY_REFUSED =
  'Quotes and payment schedules are read-only on this organisation’s plan, so nothing has changed.';

export function noVendorMatches(typed: string): string {
  return `No vendor matches “${typed.trim()}”.`;
}

export function lineTaken(line: string, vendor: string): string {
  return `${line} is already agreed in the quote from ${vendor}, so this quote was not saved. Untick it in that quote first.`;
}

/** The quote another vendor holds a line under, if any; a superseded quote holds none. */
export function agreedElsewhere(budget: Budget, lineId: string, vendorId: string): Quote | null {
  return (
    budget.quotes.find((one) => one.vendor.id !== vendorId && one.lines.includes(lineId)) ?? null
  );
}

export function scheduledFor(budget: Budget, vendorId: string): Payment[] {
  return budget.payments
    .filter((one) => one.vendorId === vendorId)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export function sum(payments: readonly Payment[]): number {
  return payments.reduce((total, one) => total + one.amount, 0);
}

export type Difference = 'matches' | 'short' | 'over';

export function differenceOf(quoted: number, scheduled: number): Difference {
  return scheduled === quoted ? 'matches' : scheduled < quoted ? 'short' : 'over';
}

export function differenceLine(quoted: number, scheduled: number, locale: string): string {
  const gap = money(Math.abs(quoted - scheduled), CURRENCY, locale);

  switch (differenceOf(quoted, scheduled)) {
    case 'matches':
      return 'The schedule matches the quote.';
    case 'short':
      return `${gap} of the quote is not scheduled yet.`;
    case 'over':
      return `The schedule is ${gap} over the quote.`;
  }
}

export interface Due {
  payment: Payment;
  vendor: QuotedVendor;
  overdue: boolean;
}

/** Every unpaid payment on every quoted vendor: soonest first, then by vendor name; before today is Overdue. */
export function everythingDue(budget: Budget, today: string): Due[] {
  const vendors = new Map(budget.quotes.map((one) => [one.vendor.id, one.vendor]));

  return budget.payments
    .flatMap((payment) => {
      const vendor = vendors.get(payment.vendorId);

      return vendor == null ? [] : [{ payment, vendor, overdue: payment.dueOn < today }];
    })
    .sort(
      (a, b) =>
        a.payment.dueOn.localeCompare(b.payment.dueOn) ||
        a.vendor.name.localeCompare(b.vendor.name, 'en', { sensitivity: 'accent' }),
    );
}

export interface PaymentDraft {
  description: string;
  amount: string;
  dueOn: string;
}

export type PaymentField = keyof PaymentDraft;
export type PaymentProblems = Partial<Record<PaymentField, string>>;

export const BLANK_PAYMENT: PaymentDraft = { description: '', amount: '', dueOn: '' };

export function draftOfPayment(payment: Payment): PaymentDraft {
  return {
    description: payment.description,
    amount: typedAmount(payment.amount, CURRENCY),
    dueOn: payment.dueOn,
  };
}

export function paymentProblems(
  draft: PaymentDraft,
  quote: Quote,
  dateOf: (day: string) => string,
): PaymentProblems {
  const problems: PaymentProblems = {};

  if (draft.description.trim() === '') problems.description = 'Enter what the payment is for.';
  else if (lengthOf(draft.description) > QUOTE_LIMITS.description)
    problems.description = `Shorten what the payment is for to ${QUOTE_LIMITS.description} characters or fewer.`;
  if (parsedAmount(draft.amount, CURRENCY) == null) problems.amount = amountProblem(CURRENCY);
  if (draft.dueOn === '') problems.dueOn = 'Enter the date due.';
  else if (draft.dueOn < quote.quotedOn)
    problems.dueOn = `The date due cannot be before the quote from ${quote.vendor.name} on ${dateOf(quote.quotedOn)}. Choose that date or a later one.`;

  return problems;
}

export type Refusal = 'second_quote' | 'vendor_gone' | 'line_taken';

export interface Opened {
  form: QuoteForm;
  draft: QuoteDraft;
  problems: QuoteProblems;
  refusal: Refusal | null;
  list: boolean;
}

export type PaymentOpen =
  | { kind: 'add'; draft: PaymentDraft; problems: PaymentProblems }
  | { kind: 'amend'; id: string; draft: PaymentDraft; problems: PaymentProblems };

export interface BudgetStart {
  budget: Budget;
  vendors: Vendor[];
  readOnly: boolean;
  quote: Opened | null;
  payment: PaymentOpen | null;
  removing: string | null;
  earlier: boolean;
}

const BLOOM = 'v4';
/** The line the `line_taken` refusal names: Bloom & Co's quote took it while the form was open. */
export const TAKEN_LINE = 'l4';
const ECLAT = 'v9';

function opened(form: QuoteForm, draft: QuoteDraft, extra: Partial<Opened> = {}): Opened {
  return { form, draft, problems: {}, refusal: null, list: false, ...extra };
}

export function budgetStart(
  state: string,
  vendorId: string | null,
  dateOf: (day: string) => string,
): BudgetStart {
  const full = sampleBudget();
  const vendors = sampleVendors();
  const start: BudgetStart = {
    budget: full,
    vendors,
    readOnly: false,
    quote: null,
    payment: null,
    removing: null,
    earlier: false,
  };
  const quote = full.quotes.find((one) => one.vendor.id === (vendorId ?? BLOOM));
  const current = quote ?? full.quotes[0];
  const harbour = vendors.find((one) => one.name === 'Harbour Shuttle');
  const typedAdd: QuoteDraft = {
    ...BLANK_QUOTE,
    vendorId: harbour?.id ?? '',
    typed: harbour?.name ?? '',
    covers: 'Two shuttles between the hotel and the venue, every 30 minutes.',
    amount: '1,450.00',
    quotedOn: '2026-11-02',
  };

  switch (state) {
    case 'no_quotes':
      return { ...start, budget: { quotes: [], payments: [] } };
    case 'nothing_due':
      return { ...start, budget: { ...full, payments: [] } };
    case 'read_only':
      return { ...start, readOnly: true };
    case 'add':
      return { ...start, quote: opened('add', BLANK_QUOTE, { list: true }) };
    case 'vendor_typed':
      return { ...start, quote: opened('add', { ...BLANK_QUOTE, typed: 'bl' }, { list: true }) };
    case 'vendor_none':
      return { ...start, quote: opened('add', { ...BLANK_QUOTE, typed: 'eclat' }, { list: true }) };
    case 'no_vendors':
      return {
        ...start,
        vendors: vendors.filter((one) => one.archivedOn != null),
        quote: opened('add', BLANK_QUOTE, { list: true }),
      };
    case 'add_blank':
      return {
        ...start,
        quote: opened('add', BLANK_QUOTE, { problems: quoteProblems(BLANK_QUOTE, 'add', TODAY) }),
      };
    case 'invalid_amount':
    case 'future_date':
    case 'too_long': {
      const draft: QuoteDraft = {
        ...typedAdd,
        ...(state === 'invalid_amount' ? { amount: '1,450.505' } : {}),
        ...(state === 'future_date' ? { quotedOn: '2026-11-30' } : {}),
        ...(state === 'too_long'
          ? { covers: typedAdd.covers.repeat(9), number: 'HS-'.repeat(22) }
          : {}),
      };

      return {
        ...start,
        quote: opened('add', draft, { problems: quoteProblems(draft, 'add', TODAY) }),
      };
    }
    case 'second_quote':
      return {
        ...start,
        quote: opened('add', typedAdd, { refusal: 'second_quote' }),
      };
    case 'vendor_gone':
      return { ...start, quote: opened('add', typedAdd, { refusal: 'vendor_gone' }) };
    case 'line_taken':
      return { ...start, quote: opened('add', typedAdd, { refusal: 'line_taken' }) };
    case 'revise':
      return current == null ? start : { ...start, quote: opened('revise', draftOfQuote(current)) };
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
      return { ...start, payment: { kind: 'add', draft: BLANK_PAYMENT, problems: {} } };
    case 'payment_blank':
      return current == null
        ? start
        : {
            ...start,
            payment: {
              kind: 'add',
              draft: BLANK_PAYMENT,
              problems: paymentProblems(BLANK_PAYMENT, current, dateOf),
            },
          };
    case 'before_quote': {
      const draft: PaymentDraft = { description: 'Balance', amount: '600.00', dueOn: '2026-10-01' };

      return current == null
        ? start
        : {
            ...start,
            payment: { kind: 'add', draft, problems: paymentProblems(draft, current, dateOf) },
          };
    }
    case 'amend': {
      const first = current == null ? undefined : scheduledFor(full, current.vendor.id)[0];

      return first == null
        ? start
        : {
            ...start,
            payment: { kind: 'amend', id: first.id, draft: draftOfPayment(first), problems: {} },
          };
    }
    case 'remove': {
      const first = current == null ? undefined : scheduledFor(full, current.vendor.id)[0];

      return { ...start, removing: first?.id ?? null };
    }
    case 'earlier':
      return { ...start, earlier: true };
    default:
      return start;
  }
}

export interface DemoLink {
  to: string;
  name: string;
}

const EVENT = '/demo/events/evt-gala-4';

const at = (state?: string, vendor?: string, as?: string): string => {
  const query = new URLSearchParams({ area: 'budget' });
  if (vendor != null) query.set('vendor', vendor);
  if (as != null) query.set('as', as);
  if (state != null) query.set('state', state);

  return `${EVENT}?${query.toString()}`;
};

export const QUOTES_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'On the Budget page',
    states: [
      { to: at(), name: 'Owner, four vendors quoted and everything due' },
      { to: at(undefined, undefined, 'ana'), name: 'The event’s Lead, the same' },
      { to: at('no_quotes'), name: 'No quotes on this event yet' },
      { to: at('nothing_due'), name: 'Quotes, and nothing is due' },
      { to: at('read_only'), name: 'After a downgrade: read only (read_only)' },
    ],
  },
  {
    name: 'Add a quote: choosing the vendor',
    states: [
      { to: at('add'), name: 'Add a quote, the vendors offered' },
      { to: at('vendor_typed'), name: 'Narrowed by “bl”, one already quoted' },
      { to: at('vendor_none'), name: 'No match, for an owner or admin' },
      { to: at('vendor_none', undefined, 'ana'), name: 'No match, for the Lead' },
      { to: at('no_vendors'), name: 'There are no vendors to choose from' },
      { to: at('no_vendors', undefined, 'ana'), name: 'No vendors, for the Lead' },
    ],
  },
  {
    name: 'Add a quote: its checks and refusals',
    states: [
      { to: at('add_blank'), name: 'Sent with nothing typed (blank)' },
      { to: at('invalid_amount'), name: 'Too many decimals (invalid_amount)' },
      { to: at('future_date'), name: 'Quoted in the future (future_date)' },
      { to: at('too_long'), name: 'Over 500 and 64 characters (too_long)' },
      { to: at('line_taken'), name: 'A line agreed meanwhile (line_taken)' },
      { to: at('second_quote'), name: 'Quoted by someone else meanwhile (second_quote)' },
      { to: at('vendor_gone'), name: 'The vendor archived meanwhile (vendor_gone)' },
    ],
  },
  {
    name: 'A vendor’s page',
    states: [
      { to: at(undefined, BLOOM), name: 'Bloom & Co: €600.00 not scheduled yet' },
      { to: at(undefined, 'v11'), name: 'Fola Strings: €250.00 over the quote' },
      { to: at('earlier', ECLAT), name: 'Éclat Catering: matches, the earlier quote shown' },
      { to: at(undefined, 'v8'), name: 'Delta Frames: no payments scheduled yet' },
      { to: at(undefined, BLOOM, 'ana'), name: 'The Lead: the name is plain text' },
      { to: at('read_only', ECLAT), name: 'After a downgrade: read only' },
    ],
  },
  {
    name: 'Revise, correct, and the schedule',
    states: [
      { to: at('revise', ECLAT), name: 'Revise the quote' },
      { to: at('revise_unchanged', ECLAT), name: 'Revise with nothing changed (revise_unchanged)' },
      { to: at('correct', ECLAT), name: 'Correct the quote' },
      { to: at('add_payment', BLOOM), name: 'Add a payment' },
      { to: at('payment_blank', BLOOM), name: 'A payment sent blank' },
      { to: at('before_quote', BLOOM), name: 'Due before the date quoted (before_quote)' },
      { to: at('amend', ECLAT), name: 'Change a payment' },
      { to: at('remove', ECLAT), name: 'Remove a payment, asked in its row' },
    ],
  },
];
