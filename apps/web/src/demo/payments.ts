import {
  CURRENCY,
  LOCALE,
  READER,
  TODAY,
  type Payment,
  longDay,
  money,
  owed,
  shortDay,
} from './budget.ts';
import { type DemoGroup, budgetAt } from './budgetSample.ts';
import { type SampleEvent } from './events.ts';
import { PW } from './paymentsWords.ts';
import {
  BLANK_PAYMENT,
  type Budget,
  type Marking,
  type Quote,
  type QuotesStart,
  QUOTE_LIMITS,
  SAVOUR,
  amountProblem,
  draftToMark,
  firstOverdue,
  lengthOf,
  markProblems,
  minorDigits,
  nextPaymentId,
  pageVendor,
  parsedAmount,
  scheduledFor,
  typedAmount,
} from './quotes.ts';
import { QW } from './quotesWords.ts';

export const BLOOM = 'v3';

/** sc-88's {{currency}}: the event currency's name from Intl in the reader's language, never its code. */
export const CURRENCY_NAME =
  new Intl.DisplayNames([LOCALE], { type: 'currency' }).of(CURRENCY) ?? CURRENCY;

/** Board Budget-A-Payments' names, each drawn on Bloom & Co's page; `already_cancelled` is sc-88's second refusal, kept beside them. */
export const PAYMENTS_STATES: readonly string[] = [
  'schedule',
  'mark_paid',
  'paid_more',
  'mark_refused',
  'already_paid',
  'already_cancelled',
  'marked',
  'cancel',
  'cancelled',
  'already_made',
  'made_early',
  'mark_currency',
  'mark_plan',
  'mark_future',
  'added',
  'added_deleted',
  'payments_read_only',
];

export const SHAPE_STATES: readonly string[] = [
  'shape_deposit',
  'shape_clamped',
  'shape_short',
  'shape_refused',
  'shape_failed',
  'shape_raced',
];

export const REMINDER_STATES: readonly string[] = [
  'reminders',
  'reminders_bad',
  'reminders_plan_lost',
];

export function paymentsVendor(state: string, vendor: string | null): string | null {
  if (vendor != null) return vendor;
  if (PAYMENTS_STATES.includes(state)) return BLOOM;
  if (SHAPE_STATES.includes(state)) return SAVOUR;

  return pageVendor(state, null);
}

/** Only the problems already showing are kept, each as the draft now reads, so a field clears once it is fixed. */
export function keptOf<K extends string>(
  shown: Partial<Record<K, string>>,
  now: Partial<Record<K, string>>,
): Partial<Record<K, string>> {
  const kept: Partial<Record<K, string>> = {};
  for (const key of Object.keys(shown) as K[]) {
    const line = now[key];
    if (line != null) kept[key] = line;
  }

  return kept;
}

/** Every payment on a vendor's schedule, paid and cancelled ones too, soonest due first. */
export function scheduleOf(budget: Budget, vendorId: string): Payment[] {
  return budget.payments
    .filter((one) => one.vendorId === vendorId)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.id.localeCompare(b.id));
}

export function toMark(budget: Budget, vendorId: string): Payment | null {
  return firstOverdue(budget, vendorId) ?? scheduledFor(budget, vendorId).find(owed) ?? null;
}

export function differenceWords(scheduled: number, paid: number): string | null {
  if (paid === scheduled) return null;

  return paid > scheduled
    ? PW.moreThan(money(paid - scheduled))
    : PW.lessThan(money(scheduled - paid));
}

export function typedDifference(payment: Payment, typed: string): string | null {
  const paid = parsedAmount(typed);
  const words = paid == null ? null : differenceWords(payment.amount, paid);

  return words == null ? null : PW.differenceStays(words);
}

export function paidLineOf(payment: Payment): string {
  const { paid } = payment;
  if (paid == null) return '';

  return PW.paidLine(
    money(paid.amount),
    shortDay(paid.on),
    differenceWords(payment.amount, paid.amount),
    paid.by,
  );
}

export const REASON_LIMIT = 200;

export interface Cancelling {
  id: string;
  why: string;
  problem: string | null;
}

export function reasonProblem(why: string): string | null {
  return lengthOf(why) > REASON_LIMIT ? PW.reasonTooLong(REASON_LIMIT) : null;
}

export function cancelledOf(payment: Payment, why: string): Payment {
  return { ...payment, cancelled: { why: why.trim() } };
}

export function cancelledLine(payment: Payment): string {
  const why = payment.cancelled?.why ?? '';
  const told = why === '' ? '' : `${why.charAt(0).toLocaleLowerCase('en')}${why.slice(1)}`;

  return PW.cancelledLine(told, money(payment.amount));
}

export interface MadeDraft {
  vendorId: string;
  what: string;
  amount: string;
  paidOn: string;
  reference: string;
}

export type MadeField = 'what' | 'amount' | 'paidOn' | 'reference';
export type MadeProblems = Partial<Record<MadeField, string>>;

export interface MadeOpen {
  draft: MadeDraft;
  problems: MadeProblems;
}

export function firstQuoteOn(quote: Quote): string {
  return quote.earlier.reduce(
    (first, one) => (one.quotedOn < first ? one.quotedOn : first),
    quote.quotedOn,
  );
}

export function exampleAmount(currency = CURRENCY): string {
  const digits = minorDigits(currency);

  return typedAmount(3500 * 10 ** digits + (digits === 0 ? 0 : 5 * 10 ** (digits - 1)), currency);
}

export function madeProblems(draft: MadeDraft, quote: Quote | undefined): MadeProblems {
  const problems: MadeProblems = {};

  if (draft.what.trim() === '') problems.what = PW.enterWhatItWasFor;
  else if (lengthOf(draft.what) > QUOTE_LIMITS.what)
    problems.what = PW.descriptionTooLong(QUOTE_LIMITS.what);
  if (parsedAmount(draft.amount) == null) problems.amount = amountProblem();
  if (draft.paidOn === '') problems.paidOn = QW.datePaidBlank;
  else if (draft.paidOn > TODAY) problems.paidOn = PW.datePaidAhead;
  else if (quote != null && draft.paidOn < firstQuoteOn(quote))
    problems.paidOn = PW.beforeFirstQuote(quote.vendor.name, longDay(firstQuoteOn(quote)));
  if (lengthOf(draft.reference) > QUOTE_LIMITS.reference)
    problems.reference = PW.referenceTooLong(QUOTE_LIMITS.reference);

  return problems;
}

export function madePayment(draft: MadeDraft, payments: readonly Payment[], by: string): Payment {
  const amount = parsedAmount(draft.amount) ?? 0;

  return {
    id: nextPaymentId(payments),
    vendorId: draft.vendorId,
    what: draft.what.trim(),
    amount,
    dueOn: draft.paidOn,
    paid: { amount, on: draft.paidOn, by, reference: draft.reference.trim() },
    cancelled: null,
  };
}

export type Shape = 'deposit' | 'instalments' | 'before' | 'after' | 'rows';

export const SHAPES: readonly Shape[] = ['deposit', 'instalments', 'before', 'after', 'rows'];

export interface Term {
  what: string;
  share: number;
  from: 'quoted' | 'before' | 'after';
  days: number;
}

const term = (what: string, share: number, from: Term['from'], days = 0): Term => ({
  what,
  share,
  from,
  days,
});

/** sc-1332's table: each row a share of the quote, due on the date quoted or counted from the event's days. */
export const SHAPE_TERMS: Record<Exclude<Shape, 'rows'>, readonly Term[]> = {
  deposit: [term(PW.deposit, 50, 'quoted'), term(PW.balance, 50, 'before', 14)],
  instalments: [
    term(PW.deposit, 50, 'quoted'),
    term(PW.secondInstalment, 30, 'before', 60),
    term(PW.balance, 20, 'before', 14),
  ],
  before: [term(PW.inFull, 100, 'before', 14)],
  after: [term(PW.inFull, 100, 'after', 7)],
};

export interface ShapeDraft {
  what: string;
  share: string;
  days: string;
}

export type ShapeField = keyof ShapeDraft;
export type ShapeProblems = Partial<Record<ShapeField, string>>;

/** `terms` are the shape's rows as offered; `typed` is each row as the organiser has it, and only `typed` is saved. */
export interface Shaping {
  shape: Shape;
  terms: readonly Term[];
  typed: readonly ShapeDraft[];
  problems: readonly ShapeProblems[];
  raced: boolean;
  failed: boolean;
}

export const SHAPE_LIMITS = { share: 100, days: 730 } as const;

export function draftOfTerm(one: Term): ShapeDraft {
  return { what: one.what, share: String(one.share), days: String(one.days) };
}

export function shapingFrom(shape: Shape, terms: readonly Term[], raced = false): Shaping {
  return {
    shape,
    terms,
    typed: terms.map(draftOfTerm),
    problems: terms.map(() => ({})),
    raced,
    failed: false,
  };
}

export function shapingOf(shape: Shape, raced = false): Shaping {
  return shapingFrom(shape, shape === 'rows' ? [] : SHAPE_TERMS[shape], raced);
}

export function typedShare(typed: string): number | null {
  const plain = typed.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(plain)) return null;
  const share = Number(plain);

  return share <= SHAPE_LIMITS.share ? share : null;
}

export function typedShapeDays(typed: string): number | null {
  const plain = typed.trim();
  if (!/^\d+$/.test(plain)) return null;
  const days = Number(plain);

  return days <= SHAPE_LIMITS.days ? days : null;
}

export function shapeProblems(one: Term, draft: ShapeDraft): ShapeProblems {
  const problems: ShapeProblems = {};

  if (draft.what.trim() === '') problems.what = QW.enterWhatFor;
  else if (lengthOf(draft.what) > QUOTE_LIMITS.what)
    problems.what = QW.whatForTooLong(QUOTE_LIMITS.what);
  if (typedShare(draft.share) == null) problems.share = PW.enterShare;
  if (one.from !== 'quoted' && typedShapeDays(draft.days) == null)
    problems.days = PW.enterShapeDays;

  return problems;
}

export function shapingProblems(shaping: Shaping): ShapeProblems[] {
  return shaping.terms.map((one, index) =>
    shapeProblems(one, shaping.typed[index] ?? draftOfTerm(one)),
  );
}

export function anyShapeProblem(problems: readonly ShapeProblems[]): boolean {
  return problems.some((one) => Object.keys(one).length > 0);
}

/** The rows as typed; a share or a count of days not yet valid counts as 0 or as offered, and the field says so. */
export function typedTerms(shaping: Shaping): Term[] {
  return shaping.terms.map((one, index) => {
    const draft = shaping.typed[index] ?? draftOfTerm(one);

    return {
      what: draft.what.trim(),
      share: typedShare(draft.share) ?? 0,
      from: one.from,
      days: typedShapeDays(draft.days) ?? one.days,
    };
  });
}

export function sharesTyped(shaping: Shaping): boolean {
  return shaping.typed.every((one) => typedShare(one.share) != null);
}

export function retyped(shaping: Shaping, index: number, change: Partial<ShapeDraft>): Shaping {
  const next: Shaping = {
    ...shaping,
    typed: shaping.typed.map((one, at) => (at === index ? { ...one, ...change } : one)),
  };
  const now = shapingProblems(next);

  return {
    ...next,
    problems: shaping.problems.map((shown, at) => keptOf(shown, now[at] ?? {})),
  };
}

export function offersShapes(budget: Budget, vendorId: string): boolean {
  return !budget.payments.some((one) => one.vendorId === vendorId);
}

export interface EventDays {
  starts: string;
  ends: string;
}

export function eventDays(event: Pick<SampleEvent, 'startsAt' | 'endsAt' | 'timeZone'>): EventDays {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: event.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return { starts: day.format(new Date(event.startsAt)), ends: day.format(new Date(event.endsAt)) };
}

export function addDays(day: string, days: number): string {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);

  return at.toISOString().slice(0, 10);
}

export interface ShapeRow extends Term {
  dueOn: string;
  clamped: boolean;
  amount: number;
}

/** Each row rounded to the minor unit; when the shares come to 100 the last takes what is left, so the rows add up to the quote. */
export function shapeRows(
  terms: readonly Term[],
  quote: Pick<Quote, 'amount' | 'quotedOn'>,
  days: EventDays,
): ShapeRow[] {
  const parts = terms.map((one) => Math.round(one.share * 100));
  const whole = parts.reduce((sum, one) => sum + one, 0) === 10000;
  let given = 0;

  return terms.map((one, index) => {
    const counted =
      one.from === 'quoted'
        ? quote.quotedOn
        : one.from === 'before'
          ? addDays(days.starts, -one.days)
          : addDays(days.ends, one.days);
    const clamped = counted < quote.quotedOn;
    const amount =
      whole && index === terms.length - 1
        ? quote.amount - given
        : Math.round((quote.amount * (parts[index] ?? 0)) / 10000);
    given += amount;

    return { ...one, dueOn: clamped ? quote.quotedOn : counted, clamped, amount };
  });
}

const SHARE = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 2 });

export function shareWords(share: number): string {
  return SHARE.format(share / 100);
}

export function shapeLine(row: ShapeRow): string {
  const when =
    row.from === 'quoted'
      ? PW.onTheDateQuoted
      : row.from === 'before'
        ? PW.daysBefore(row.days)
        : PW.daysAfter(row.days);

  return PW.shapeLine(shareWords(row.share), when, shortDay(row.dueOn), row.clamped);
}

export function sharesLine(rows: readonly ShapeRow[], quoted: number): string | null {
  const total = rows.reduce((sum, one) => sum + Math.round(one.share * 100), 0) / 100;
  if (total === 100) return null;
  const scheduled = rows.reduce((sum, one) => sum + one.amount, 0);
  const gap = money(Math.abs(quoted - scheduled));

  return total < 100
    ? PW.sharesShort(shareWords(total), gap)
    : PW.sharesOver(shareWords(total), gap);
}

export function shapePayments(
  rows: readonly ShapeRow[],
  vendorId: string,
  payments: readonly Payment[],
): Payment[] {
  return rows.reduce<Payment[]>(
    (added, row) => [
      ...added,
      {
        id: nextPaymentId([...payments, ...added]),
        vendorId,
        what: row.what,
        amount: row.amount,
        dueOn: row.dueOn,
        paid: null,
        cancelled: null,
      },
    ],
    [],
  );
}

export const REMINDER_DAYS = 3;

export function daysProblem(typed: string): string | null {
  const plain = typed.trim();
  const days = /^\d+$/.test(plain) ? Number(plain) : 0;

  return days >= 1 && days <= 30 ? null : PW.enterDays;
}

export interface Changing {
  typed: string;
  problem: string | null;
}

export function remindersStart(state: string): { days: number; changing: Changing | null } {
  return state === 'reminders_bad'
    ? { days: REMINDER_DAYS, changing: { typed: '31', problem: daysProblem('31') } }
    : { days: REMINDER_DAYS, changing: null };
}

export interface PaymentsStart extends QuotesStart {
  marking: Marking | null;
  marked: string | null;
  said: string;
  cancelling: Cancelling | null;
  made: MadeOpen | null;
  shaping: Shaping | null;
  addedPaid: readonly string[];
  deleted: string | null;
}

/** Two payments added as already paid at the foot of Bloom & Co's Schedule: one by the reader, one by Julien Moreau. */
const ADDED: readonly Payment[] = [
  {
    id: 'p20',
    vendorId: BLOOM,
    what: 'Extra stems',
    amount: 6000,
    dueOn: '2026-10-31',
    paid: { amount: 6000, on: '2026-10-31', by: 'Julien Moreau', reference: '' },
    cancelled: null,
  },
  {
    id: 'p21',
    vendorId: BLOOM,
    what: 'Buttonholes',
    amount: 12000,
    dueOn: '2026-11-02',
    paid: { amount: 12000, on: '2026-11-02', by: READER, reference: '' },
    cancelled: null,
  },
];

export function deletedLine(payment: Payment, vendor: string): string {
  return PW.deleted(money(payment.amount), vendor, longDay(payment.dueOn), payment.what);
}

const WHY = 'The venue supplies the arch flowers';
const LONG_REFERENCE =
  'Paid by bank transfer on the Tuesday after the meeting with Ngozi, reference given on the phone that evening';
const TOO_LONG_WHAT =
  'Second instalment for the wedding breakfast, the canapés on the lawn and the late supper after the band';
const BALANCE = 'p6';
const PAID_MORE = 90000;

export function paymentsStart(
  base: QuotesStart,
  state: string,
  vendorId: string | null,
): PaymentsStart {
  const start: PaymentsStart = {
    ...base,
    marking: null,
    marked: null,
    said: '',
    cancelling: null,
    made: null,
    shaping: null,
    addedPaid: [],
    deleted: null,
  };
  if (vendorId == null) return start;
  const quote = base.budget.quotes.find((one) => one.vendor.id === vendorId);
  const due = toMark(base.budget, vendorId);
  const change = (next: Payment): Budget => ({
    ...base.budget,
    payments: base.budget.payments.map((one) => (one.id === next.id ? next : one)),
  });
  const none: Budget = {
    ...base.budget,
    payments: base.budget.payments.filter((one) => one.vendorId !== vendorId),
  };
  const shaped = (shaping: Shaping, budget = none): PaymentsStart => ({
    ...start,
    budget,
    payment: { draft: BLANK_PAYMENT, problems: {} },
    shaping,
  });

  if (state === 'added' || state === 'added_deleted') {
    const kept = state === 'added' ? ADDED : ADDED.slice(0, 1);
    const gone = ADDED[1];

    return {
      ...start,
      budget: { ...base.budget, payments: [...base.budget.payments, ...kept] },
      addedPaid: kept.map((one) => one.id),
      deleted:
        state === 'added_deleted' && gone != null && quote != null
          ? deletedLine(gone, quote.vendor.name)
          : null,
    };
  }
  if (state === 'payments_read_only') return { ...start, readOnly: true };
  if (state === 'add_payment') return shaped(shapingOf('rows'));
  if (state === 'shape_deposit') return shaped(shapingOf('deposit'));
  if (state === 'shape_clamped')
    return shaped(
      shapingFrom(
        'instalments',
        SHAPE_TERMS.instalments.map((one, index) => (index === 2 ? { ...one, share: 15 } : one)),
      ),
    );
  if (state === 'shape_short')
    return shaped(
      shapingFrom(
        'deposit',
        SHAPE_TERMS.deposit.map((one, index) => (index === 1 ? { ...one, share: 40 } : one)),
      ),
    );
  if (state === 'shape_refused') {
    const offered = shapingOf('instalments');
    const typed: ShapeDraft[] = [
      { what: '  ', share: '50', days: '0' },
      { what: TOO_LONG_WHAT, share: '30.555', days: '60' },
      { what: PW.balance, share: '20', days: '731' },
    ];
    const refused = { ...offered, typed };

    return shaped({ ...refused, problems: shapingProblems(refused) });
  }
  if (state === 'shape_failed') return shaped({ ...shapingOf('instalments'), failed: true });
  if (state === 'shape_raced') return shaped(shapingOf('deposit', true), base.budget);
  if (state === 'already_made' || state === 'made_early') {
    const draft: MadeDraft = {
      vendorId,
      what: 'Buttonholes',
      amount: '120.00',
      paidOn: state === 'made_early' ? '2026-10-05' : '2026-11-02',
      reference: '',
    };

    return {
      ...start,
      made: { draft, problems: state === 'made_early' ? madeProblems(draft, quote) : {} },
    };
  }
  if (due == null) return start;
  const more = due.id === BALANCE ? PAID_MORE : due.amount;
  const marking = (extra: Partial<Marking> = {}): Marking => ({
    id: due.id,
    draft: draftToMark(due),
    problems: {},
    refused: null,
    ...extra,
  });

  switch (state) {
    case 'mark_paid':
      return { ...start, marking: marking() };
    case 'paid_more':
      return {
        ...start,
        marking: marking({ draft: { ...draftToMark(due), amount: typedAmount(more) } }),
      };
    case 'mark_refused': {
      const draft = { ...draftToMark(due), amount: '0', reference: LONG_REFERENCE };

      return { ...start, marking: marking({ draft, problems: markProblems(draft, due) }) };
    }
    case 'already_paid':
      return {
        ...start,
        budget: change({
          ...due,
          paid: { amount: due.amount, on: '2026-11-02', by: 'Julien Moreau', reference: '' },
        }),
        marking: marking({ refused: 'paid' }),
      };
    case 'already_cancelled':
      return {
        ...start,
        budget: change(cancelledOf(due, WHY)),
        marking: marking({ refused: 'cancelled' }),
      };
    case 'mark_currency':
      return { ...start, marking: marking({ refused: 'currency' }) };
    case 'mark_plan':
      return { ...start, marking: marking({ refused: 'plan' }) };
    case 'mark_future': {
      const draft = { ...draftToMark(due), paidOn: '2026-11-04' };

      return { ...start, marking: marking({ draft, problems: markProblems(draft, due) }) };
    }
    case 'marked':
      return {
        ...start,
        budget: change({ ...due, paid: { amount: more, on: TODAY, by: READER, reference: '' } }),
        marked: due.id,
        said: QW.markedPaid(money(more), longDay(TODAY)),
      };
    case 'cancel':
      return { ...start, cancelling: { id: due.id, why: WHY, problem: null } };
    case 'cancelled':
      return { ...start, budget: change(cancelledOf(due, WHY)) };
    default:
      return start;
  }
}

const bloom = (state: string) => budgetAt(state, { vendor: BLOOM });
const savour = (state: string) => budgetAt(state, { vendor: SAVOUR });
const reminders = (state: string, as?: string) =>
  `/demo/settings/payment-reminders?${new URLSearchParams({ ...(as == null ? {} : { as }), state }).toString()}`;

export const PAYMENTS_PAGES: readonly DemoGroup[] = [
  {
    name: 'Marking paid on a vendor’s page, at a desk (sc-88)',
    states: [
      {
        to: bloom('schedule'),
        name: 'Bloom & Co: the deposit paid, the balance overdue (schedule)',
      },
      { to: bloom('mark_paid'), name: 'Mark paid: the amount scheduled and today (mark_paid)' },
      { to: bloom('paid_more'), name: 'A different amount: £60.00 more (paid_more)' },
      {
        to: savour('paid_more'),
        name: 'From Due now: Savour Kitchen’s deposit, a different amount (paid_more)',
      },
      {
        to: bloom('mark_refused'),
        name: 'Refused at the fields: 0, a reference over 100 (mark_refused)',
      },
      {
        to: bloom('already_paid'),
        name: 'Marked paid meanwhile by Julien Moreau: Close only (already_paid)',
      },
      {
        to: bloom('already_cancelled'),
        name: 'Cancelled meanwhile: Close only (already_cancelled)',
      },
      {
        to: bloom('mark_currency'),
        name: 'Refused by the server: another currency, Close only (mark_currency)',
      },
      {
        to: bloom('mark_plan'),
        name: 'Refused by the server: not on this plan, Close only (mark_plan)',
      },
      {
        to: bloom('mark_future'),
        name: 'Refused at the field: a date in the future (mark_future)',
      },
    ],
  },
  {
    name: 'Marked, cancelled, already made',
    states: [
      { to: bloom('marked'), name: 'Marked paid, £60.00 more, with Undo (marked)' },
      { to: bloom('cancel'), name: 'Cancel payment: why it is not owed (cancel)' },
      { to: bloom('cancelled'), name: 'Cancelled, with Restore (cancelled)' },
      { to: bloom('already_made'), name: 'Add a payment already made: Buttonholes (already_made)' },
      { to: bloom('made_early'), name: 'Dated before the vendor’s first quote (made_early)' },
      {
        to: bloom('added'),
        name: 'Two added as already paid, by you and by Julien Moreau, with Undo (added)',
      },
      {
        to: bloom('added_deleted'),
        name: 'Undo deleted Buttonholes: the line says so (added_deleted)',
      },
      {
        to: budgetAt('payments_read_only', { vendor: BLOOM, plan: 'downgraded' }),
        name: 'Read only after a downgrade: the overdue balance is no longer chased (payments_read_only)',
      },
    ],
  },
  {
    name: 'How it is paid, in Add a payment (sc-1332)',
    states: [
      {
        to: savour('add_payment'),
        name: 'Five shapes, Enter rows yourself the default (add_payment)',
      },
      { to: savour('shape_deposit'), name: 'Deposit and balance, from the quote (shape_deposit)' },
      { to: savour('shape_clamped'), name: 'Set to the date quoted, 95% (shape_clamped)' },
      {
        to: savour('shape_short'),
        name: 'Shares that come to 90%: not adjusted, still saves (shape_short)',
      },
      {
        to: savour('shape_refused'),
        name: 'Refused at the field: blank, too long, percentage, days (shape_refused)',
      },
      {
        to: savour('shape_failed'),
        name: 'The save failed: nothing added, rows as filled, Save 3 payments sends them again (shape_failed)',
      },
      { to: savour('shape_raced'), name: 'Someone got there first: the 409 (shape_raced)' },
    ],
  },
  {
    name: 'Payment reminders, in Settings (sc-95)',
    states: [
      { to: reminders('reminders'), name: 'When reminders go, and who hears (reminders)' },
      { to: reminders('reminders_bad'), name: 'Change, refused: 31 days (reminders_bad)' },
      {
        to: `${reminders('reminders_plan_lost')}&plan=downgraded`,
        name: 'After a downgrade: reminders are off, and why (reminders_plan_lost)',
      },
      { to: reminders('reminders', 'ana'), name: 'A Member: refused, as Vendors refuses one' },
    ],
  },
];
