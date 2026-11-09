import {
  AS_OF_TIME,
  CATEGORIES,
  CEILINGS,
  CEILING_CHANGE,
  CHANGED_SINCE,
  COLLEAGUE,
  CURRENCY,
  type Category,
  type Cover,
  EVENT_NAME,
  GUESTS,
  HEADS_IF_ALL_COME,
  LINES,
  type Line,
  type LinkState,
  NOW_TIME,
  OPENED,
  PAID_BEFORE,
  PAYERS,
  PAYMENTS,
  type Payer,
  type PayerKey,
  type Payment,
  REMINDER,
  REMINDERS,
  RENAMED,
  TODAY,
  VENDORS,
  VENDOR_PAYERS,
  type VendorKey,
  ZONE,
} from './BudgetSample.ts';
import { writtenTime } from '../clock.ts';
import { W, say } from './BudgetWords.ts';

export const BUDGET_STATES = [
  'populated',
  'early_on',
  'scrolled',
  'loading',
  'live_update',
  'not_live',
  'reconnecting',
  'never_loaded',
  'no_lines',
  'nothing_due',
  'mark_paid_open',
  'mark_paid_earlier',
  'marked_paid',
  'refused_paid',
  'refused_cancelled',
  'read_only',
  'no_budget',
  'refused_currency',
  'refused_plan',
  'ceiling_categories_only',
  'ceiling_live_set',
  'ceiling_live_changed',
  'ceiling_live_cleared',
  'reminder_overdue',
  'reminder_mixed',
] as const;

export const PAYERS_STATES = [
  'payers',
  'payer_never_sent',
  'payer_opened',
  'no_payers',
  'no_costs',
  'payer_removed',
  'offline',
  'send_failed',
  'long_name',
  'payers_loading',
  'payers_live',
  'payers_reconnecting',
  'payers_never_loaded',
  'payers_neither',
  'payer_renamed',
  'payer_needs_amounts',
  'payer_not_priced',
  'payer_paid_past',
  'payer_passphrase',
  'payer_all_revoked',
] as const;

export const DUE_NOW_STATES = [
  'due_now',
  'due_marked',
  'due_changed',
  'due_refused',
  'due_done',
  'due_read_only',
] as const;

export const BUDGET_DEMO_STATES = [...BUDGET_STATES, ...PAYERS_STATES, ...DUE_NOW_STATES] as const;
export type BudgetState = (typeof BUDGET_DEMO_STATES)[number];

export function budgetStateOf(value: string | undefined): BudgetState | null {
  return BUDGET_DEMO_STATES.find((state) => state === value) ?? null;
}

export function isIn<T extends string>(states: readonly T[], state: string | null): state is T {
  return state != null && (states as readonly string[]).includes(state);
}

export function money(pence: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: CURRENCY }).format(
    pence / 100,
  );
}

export function currencySymbol(locale = 'en-US'): string {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY,
  }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value ?? CURRENCY;
}

export function whole(pence: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(pence / 100);
}

function at(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

function dated(day: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { timeZone: ZONE, ...options }).format(at(day));
}

export const days = {
  short: (day: string, locale = 'en-US') =>
    dated(day, locale, { weekday: 'short', month: 'short', day: 'numeric' }),
  long: (day: string, locale = 'en-US') =>
    dated(day, locale, { weekday: 'long', month: 'long', day: 'numeric' }),
  field: (day: string, locale = 'en-US') =>
    dated(day, locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
  month: (day: string, locale = 'en-US') => dated(day, locale, { month: 'short', day: 'numeric' }),
};

export function openedAt(iso: string, locale = 'en-US'): { day: string; time: string } {
  const when = new Date(iso);
  return {
    day: new Intl.DateTimeFormat(locale, {
      timeZone: ZONE,
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(when),
    time: writtenTime(when, locale, ZONE),
  };
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export const AS_OF = { time: AS_OF_TIME, minutes: minutesOf(NOW_TIME) - minutesOf(AS_OF_TIME) };

export type LineAmount =
  | { kind: 'priced'; settled: number; ifAll: number }
  | { kind: 'notPriced' }
  | { kind: 'nothingYet' };

export function amountOf(line: Line): LineAmount {
  if (line.rate == null) return { kind: 'notPriced' };
  if (line.settled === 0 && line.ifAll === 0) return { kind: 'nothingYet' };
  return { kind: 'priced', settled: line.rate * line.settled, ifAll: line.rate * line.ifAll };
}

export interface Totals {
  settled: number;
  ifAll: number;
  notPriced: number;
}

export function totalsOf(lines: readonly Line[] = LINES): Totals {
  return lines.reduce<Totals>(
    (sum, line) => {
      const amount = amountOf(line);
      if (amount.kind === 'notPriced') return { ...sum, notPriced: sum.notPriced + 1 };
      if (amount.kind === 'nothingYet') return sum;
      return {
        ...sum,
        settled: sum.settled + amount.settled,
        ifAll: sum.ifAll + amount.ifAll,
      };
    },
    { settled: 0, ifAll: 0, notPriced: 0 },
  );
}

export function perHeadOf(totals: Totals = totalsOf()): { settled: number; ifAll: number } {
  return {
    settled: Math.round(totals.settled / GUESTS.coming),
    ifAll: Math.round(totals.ifAll / HEADS_IF_ALL_COME),
  };
}

export function categoriesIn(lines: readonly Line[] = LINES): Category[] {
  return CATEGORIES.filter((category) => lines.some((line) => line.category === category));
}

export type CeilingState = 'within' | 'close' | 'overIf' | 'over';

export function ceilingState(limit: number, settled: number, ifAll: number): CeilingState {
  if (settled > limit) return 'over';
  if (ifAll > limit) return 'overIf';
  if (ifAll * 10 >= limit * 9) return 'close';
  return 'within';
}

export function categoryTotals(category: Category, lines: readonly Line[] = LINES): Totals {
  return totalsOf(lines.filter((line) => line.category === category));
}

export interface Ceilings {
  whole: number | null;
  categories: Partial<Record<Category, number>>;
}

export function wholeState(ceilings: Ceilings, totals: Totals): CeilingState | null {
  return ceilings.whole == null ? null : ceilingState(ceilings.whole, totals.settled, totals.ifAll);
}

export function categoryState(
  category: Category,
  lines: readonly Line[] = LINES,
  ceilings: Ceilings = CEILINGS,
): CeilingState | null {
  const limit = ceilings.categories[category];
  if (limit == null) return null;
  const totals = categoryTotals(category, lines);
  return ceilingState(limit, totals.settled, totals.ifAll);
}

export interface Paid {
  amount: number;
  on: string;
  by: string;
}

export interface Ledger {
  paid: Readonly<Record<string, Paid>>;
  cancelled: readonly string[];
  /** Early on, quoted but not yet on any schedule: owed by nobody yet. */
  unscheduled: readonly string[];
}

export const START_LEDGER: Ledger = {
  paid: Object.fromEntries(
    Object.entries(PAID_BEFORE).map(([id, { on, by }]) => [id, { amount: amountDue(id), on, by }]),
  ),
  cancelled: [],
  unscheduled: [],
};

function amountDue(id: string): number {
  return paymentOf(id).amount;
}

export function paymentOf(id: string): Payment {
  const found = PAYMENTS.find((payment) => payment.id === id);
  if (found == null) throw new Error(`No payment ${id} in the sample.`);
  return found;
}

export function isOwed(ledger: Ledger, id: string): boolean {
  return (
    ledger.paid[id] == null && !ledger.cancelled.includes(id) && !ledger.unscheduled.includes(id)
  );
}

export function owed(ledger: Ledger): Payment[] {
  return PAYMENTS.filter((payment) => isOwed(ledger, payment.id));
}

export function isOverdue(payment: Payment): boolean {
  return payment.due < TODAY;
}

/** The card's one step: the first payment overdue, else the soonest due (budget-a-spec.md §5). */
export function nextPayment(ledger: Ledger): Payment | null {
  const due = owed(ledger);
  return due.find(isOverdue) ?? due[0] ?? null;
}

export type CardThing =
  | { kind: 'payment'; payment: Payment }
  | { kind: 'notPriced'; count: number }
  | { kind: 'ceiling'; state: CeilingState }
  | { kind: 'nothing' };

/** The card's one thing (sc-93's pick): a payment due; early on, with nothing scheduled, what is not priced; else the ceiling. */
export function cardThing(
  ledger: Ledger,
  totals: Totals,
  ceilings: Ceilings = CEILINGS,
): CardThing {
  const next = nextPayment(ledger);
  if (next != null) return { kind: 'payment', payment: next };
  const early = PAYMENTS.every((payment) => ledger.unscheduled.includes(payment.id));
  if (early && totals.notPriced > 0) return { kind: 'notPriced', count: totals.notPriced };
  const state = wholeState(ceilings, totals);
  return state == null ? { kind: 'nothing' } : { kind: 'ceiling', state };
}

export function nextDay(day: string): string {
  const next = new Date(`${day}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export interface Plan {
  planned: number;
  committed: number;
  paid: number;
  paidCount: number;
  stillToPay: number;
  scheduledCount: number;
}

export function planOf(ledger: Ledger, totals: Totals = totalsOf()): Plan {
  const paid = Object.values(ledger.paid);
  const due = owed(ledger);
  return {
    planned: totals.settled,
    committed: Object.values(VENDORS).reduce((sum, vendor) => sum + vendor.quote, 0),
    paid: paid.reduce((sum, one) => sum + one.amount, 0),
    paidCount: paid.length,
    stillToPay: due.reduce((sum, one) => sum + one.amount, 0),
    scheduledCount: due.length,
  };
}

export function ledgerFor(state: BudgetState | null): Ledger {
  if (state === 'early_on')
    return { paid: {}, cancelled: [], unscheduled: PAYMENTS.map((payment) => payment.id) };
  if (state === 'nothing_due')
    return {
      ...START_LEDGER,
      paid: Object.fromEntries(
        PAYMENTS.map((payment) => [
          payment.id,
          START_LEDGER.paid[payment.id] ?? { amount: payment.amount, on: TODAY, by: COLLEAGUE },
        ]),
      ),
    };
  if (state === 'refused_paid')
    return paidBy(START_LEDGER, 'bloom-balance', COLLEAGUE, TODAY, amountDue('bloom-balance'));
  if (state === 'refused_cancelled') return { ...START_LEDGER, cancelled: ['bloom-balance'] };
  if (state === 'due_changed')
    return {
      ...paidBy(
        START_LEDGER,
        'bloom-balance',
        COLLEAGUE,
        CHANGED_SINCE.paidOn,
        amountDue('bloom-balance'),
      ),
      cancelled: ['savour-deposit'],
    };
  if (state === 'due_refused') return { ...START_LEDGER, cancelled: ['savour-deposit'] };
  if (state === 'due_done')
    return REMINDER.payments.reduce(
      (ledger, id) => paidBy(ledger, id, COLLEAGUE, TODAY, amountDue(id)),
      START_LEDGER,
    );
  return START_LEDGER;
}

export function paidBy(ledger: Ledger, id: string, by: string, on: string, amount: number): Ledger {
  return { ...ledger, paid: { ...ledger.paid, [id]: { amount, on, by } } };
}

export function unpaid(ledger: Ledger, id: string): Ledger {
  const rest = { ...ledger.paid };
  delete rest[id];
  return { ...ledger, paid: rest };
}

export type AmountCheck = { ok: true; pence: number } | { ok: false };

/** Above 0, at GBP's two decimal places, typed in en's number format; no upper limit. */
export function checkAmount(typed: string): AmountCheck {
  const plain = typed.trim().replace(/,/gu, '');
  if (!/^\d+(\.\d{1,2})?$/u.test(plain)) return { ok: false };
  const [units = '0', pence = ''] = plain.split('.');
  const value = Number(units) * 100 + Number(pence.padEnd(2, '0'));
  return value > 0 ? { ok: true, pence: value } : { ok: false };
}

export const REFERENCE_MAXIMUM = 100;

export function dateTooLate(day: string): boolean {
  return day > TODAY;
}

export const EARLIER_DAY = '2026-11-02';

export function referenceTooLong(typed: string): boolean {
  return typed.trim().length > REFERENCE_MAXIMUM;
}

export function typedAmount(pence: number): string {
  return (pence / 100).toFixed(2);
}

export interface Share {
  settled: number;
  ifAll: number;
}

function lineOf(key: string, lines: readonly Line[]): Line {
  const found = lines.find((line) => line.key === key);
  if (found == null) throw new Error(`No line ${key} in the sample.`);
  return found;
}

export function coverAmount(lineKey: string, share: number, lines: readonly Line[] = LINES): Share {
  const amount = amountOf(lineOf(lineKey, lines));
  if (amount.kind !== 'priced') return { settled: 0, ifAll: 0 };
  return { settled: amount.settled * share, ifAll: amount.ifAll * share };
}

/** A payer's part of one cost: a fraction, a fixed amount kept as agreed, or what is left after the fixed ones, never below 0. */
export function coverPart(
  cover: Cover,
  lines: readonly Line[] = LINES,
  payers: readonly Payer[] = PAYERS,
): Share {
  if (cover.fixed != null) return { settled: cover.fixed, ifAll: cover.fixed };
  if (cover.rest !== true) return coverAmount(cover.line, cover.share, lines);
  const amount = amountOf(lineOf(cover.line, lines));
  if (amount.kind !== 'priced') return { settled: 0, ifAll: 0 };
  const fixed = payers
    .flatMap((payer) => payer.covers)
    .reduce((sum, one) => (one.line === cover.line ? sum + (one.fixed ?? 0) : sum), 0);
  return {
    settled: Math.max(0, amount.settled - fixed),
    ifAll: Math.max(0, amount.ifAll - fixed),
  };
}

export function shareOf(
  payer: Payer,
  lines: readonly Line[] = LINES,
  payers: readonly Payer[] = PAYERS,
): Share {
  return payer.covers.reduce<Share>(
    (sum, cover) => {
      const part = coverPart(cover, lines, payers);
      return { settled: sum.settled + part.settled, ifAll: sum.ifAll + part.ifAll };
    },
    { settled: 0, ifAll: 0 },
  );
}

export function notPricedFor(payer: Payer, lines: readonly Line[] = LINES): number {
  return payer.covers.filter((cover) => amountOf(lineOf(cover.line, lines)).kind === 'notPriced')
    .length;
}

export type VendorPayers = Record<VendorKey, Partial<Record<PayerKey, number>>>;

export function payerPaid(
  ledger: Ledger,
  key: PayerKey,
  vendorPayers: VendorPayers = VENDOR_PAYERS,
): number {
  return PAYMENTS.reduce((sum, payment) => {
    const done = ledger.paid[payment.id];
    const part = vendorPayers[payment.vendor][key] ?? 0;
    return done == null ? sum : sum + Math.round(done.amount * part);
  }, 0);
}

export function stillToCome(share: Share, paid: number): Share {
  return { settled: Math.max(0, share.settled - paid), ifAll: Math.max(0, share.ifAll - paid) };
}

export interface Payers {
  has: Share;
  noPayer: number;
  noPayerCosts: number;
}

/** Has a payer counts each cost with a payer at its own amount, so with No payer yet it is the range exactly, a flagged split included. */
export function payersOf(
  lines: readonly Line[] = LINES,
  payers: readonly Payer[] = PAYERS,
): Payers {
  const covered = new Set(payers.flatMap((payer) => payer.covers.map((cover) => cover.line)));
  const left = lines.filter((line) => !covered.has(line.key));
  const totals = totalsOf(lines.filter((line) => covered.has(line.key)));
  return {
    has: { settled: totals.settled, ifAll: totals.ifAll },
    noPayer: totalsOf(left).settled,
    noPayerCosts: left.length,
  };
}

/** sc-93's live change (pm and ux, 7 Nov): a colleague's new rate for Dinner arriving from the web. */
export const LIVE_CHANGE = { line: 'dinner', from: 6800, to: 7000 };
export const LIVE_WASHED = ['perHead', 'dinner', 'planned', 'ceiling'] as const;

export function withRate(lines: readonly Line[], key: string, rate: number): Line[] {
  return lines.map((line) => (line.key === key ? { ...line, rate } : line));
}

export function payerOf(key: PayerKey, payers: readonly Payer[] = PAYERS): Payer {
  const found = payers.find((payer) => payer.key === key);
  if (found == null) throw new Error(`No payer ${key} in the sample.`);
  return found;
}

/** The link's state in words; none once every link the payer had is revoked or ended (sc-1300). */
export function linkWords(link: LinkState, locale: string, passphrase = false): string | null {
  if (link === 'revoked') return null;
  if (link === 'notSent') return say.notSent;
  const ask = passphrase ? ` ${W.asksPassphrase}` : '';
  if (link === 'sent') return `${say.sent}${ask}`;
  const at = openedAt(OPENED.last, locale);
  return `${say.opened(OPENED.times, at.day, at.time)}${ask}`;
}

export type View = { page: 'home' } | { page: 'payers' } | { page: 'payer'; key: PayerKey };
export type Refusal = 'paid' | 'cancelled' | 'currency' | 'plan';
export type CeilingLive = 'set' | 'changed' | 'cleared';
export type Washing = 'rate' | 'ceiling' | 'payers';
export type ReminderKind = keyof typeof REMINDERS;

export interface MarkForm {
  id: string;
  from: 'card' | 'dueNow';
  phase: 'open' | 'sending' | 'refused';
  refusal: Refusal | null;
  amount: number | null;
  on: string;
}

export interface DueNowSheet {
  /** The reminder's payments, or everything still owed when Everything due opens it. */
  ids: readonly string[];
  fromReminder: boolean;
  sent: string;
  lastAbout: readonly string[];
  marked: readonly string[];
  refused: readonly string[];
  readOnly: boolean;
}

export interface BudgetModel {
  figures: 'loading' | 'shown' | 'never';
  link: 'live' | 'offline' | 'reconnecting';
  wash: Washing | null;
  showLive: boolean;
  lines: readonly Line[];
  liveLine: boolean;
  costs: boolean;
  vendors: 'on' | 'readOnly';
  ledger: Ledger;
  marked: readonly string[];
  form: MarkForm | null;
  dueNow: DueNowSheet | null;
  view: View;
  payers: 'shown' | 'none' | 'noCosts';
  removed: string | null;
  links: Record<PayerKey, LinkState>;
  sending: PayerKey | null;
  failed: PayerKey | null;
  longName: boolean;
  scrolled: boolean;
  told: { words: string; at: number } | null;
  ceilings: Ceilings;
  ceilingLive: CeilingLive | null;
  payerList: readonly Payer[];
  vendorPayers: VendorPayers;
  /** Costs whose fixed split no longer adds up on the web (sc-91's Needs new amounts). */
  flagged: readonly string[];
  passphrase: readonly PayerKey[];
  news: string | null;
  washed: readonly PayerKey[];
  reminder: ReminderKind | null;
}

const LINKS = Object.fromEntries(PAYERS.map((payer) => [payer.key, payer.link])) as Record<
  PayerKey,
  LinkState
>;

/** sc-91's flag, as the web board draws it: Cars falls to £350.00 under Aunt Funmi's £400.00 fixed, Mr and Mrs Obi covering the rest. */
export const FLAG = { line: 'cars', now: 35000, fixed: 40000 } as const;

export function flaggedPayers(): Payer[] {
  return PAYERS.map((one) => {
    if (one.key === 'funmi')
      return { ...one, covers: [{ line: FLAG.line, share: 1, fixed: FLAG.fixed }] };
    if (one.key === 'obi')
      return { ...one, covers: [...one.covers, { line: FLAG.line, share: 1, rest: true }] };
    return one;
  });
}

/** Mr and Mrs Obi paid past their share: both venue payments, and Savour Kitchen's second instalment paid at £7,500.00. */
export const PAID_PAST: readonly (readonly [string, number])[] = [
  ['landmark-balance', 315000],
  ['savour-deposit', 450000],
  ['savour-second', 750000],
];

export function roomShared(): { payers: Payer[]; vendorPayers: VendorPayers } {
  return {
    payers: PAYERS.map((one) => {
      if (one.key === 'obi')
        return {
          ...one,
          covers: one.covers.map((cover) =>
            cover.line === 'room' ? { ...cover, share: 0.5 } : cover,
          ),
        };
      if (one.key === 'bakare')
        return { ...one, covers: [{ line: 'room', share: 0.5 }, ...one.covers] };
      return one;
    }),
    vendorPayers: { ...VENDOR_PAYERS, landmark: { obi: 0.5, bakare: 0.5 } },
  };
}

/** Only what an arriving change moved washes Tint (sc-85, sc-93); a rate also moves the ceiling's sentence. */
export function washes(m: BudgetModel, part: 'totals' | 'ceiling' | 'payer'): boolean {
  if (part === 'totals') return m.wash === 'rate';
  if (part === 'ceiling') return m.wash === 'ceiling' || m.wash === 'rate';
  return m.wash === 'payers';
}

export function ceilingsAfter(live: CeilingLive): Ceilings {
  if (live === 'set') return { ...CEILINGS, whole: CEILING_CHANGE.set };
  if (live === 'changed') return { ...CEILINGS, whole: CEILING_CHANGE.changed };
  return { whole: null, categories: {} };
}

/** A reminder's Due now: its payments, overdue first, each overdue one marked as the last about it (sc-95). */
export function reminderSheet(kind: ReminderKind): DueNowSheet {
  const ids = [...REMINDERS[kind].payments].sort(
    (a, b) => Number(isOverdue(paymentOf(b))) - Number(isOverdue(paymentOf(a))),
  );
  return {
    ids,
    fromReminder: true,
    sent: REMINDERS[kind].sent,
    lastAbout: ids.filter((id) => isOverdue(paymentOf(id))),
    marked: [],
    refused: [],
    readOnly: false,
  };
}

export function startOf(state: BudgetState | null, removed: string): BudgetModel {
  const base: BudgetModel = {
    figures: 'shown',
    link: 'live',
    wash: null,
    showLive: false,
    lines: LINES,
    liveLine: false,
    costs: true,
    vendors: 'on',
    ledger: ledgerFor(state),
    marked: [],
    form: null,
    dueNow: null,
    view: { page: 'home' },
    payers: 'shown',
    removed: null,
    links: LINKS,
    sending: null,
    failed: null,
    longName: false,
    scrolled: false,
    told: null,
    ceilings: CEILINGS,
    ceilingLive: null,
    payerList: PAYERS,
    vendorPayers: VENDOR_PAYERS,
    flagged: [],
    passphrase: [],
    news: null,
    washed: [],
    reminder: null,
  };
  const bloom = 'bloom-balance';
  const refused = (refusal: Refusal): BudgetModel => ({
    ...base,
    form: { id: bloom, from: 'card', phase: 'refused', refusal, amount: null, on: TODAY },
  });
  const sheet = (ids: readonly string[], more: Partial<DueNowSheet> = {}): DueNowSheet => ({
    ids,
    fromReminder: true,
    sent: REMINDER.sent,
    lastAbout: [],
    marked: [],
    refused: [],
    readOnly: false,
    ...more,
  });
  const payer = (key: PayerKey): BudgetModel['view'] => ({ page: 'payer', key });

  switch (state) {
    case 'scrolled':
      return { ...base, scrolled: true };
    case 'loading':
      return { ...base, figures: 'loading' };
    case 'live_update':
      return { ...base, showLive: true };
    case 'not_live':
      return { ...base, link: 'offline' };
    case 'reconnecting':
      return { ...base, link: 'reconnecting' };
    case 'never_loaded':
      return { ...base, figures: 'never', link: 'offline' };
    case 'no_lines':
      return { ...base, costs: false, payers: 'none' };
    case 'mark_paid_open':
      return {
        ...base,
        form: { id: bloom, from: 'card', phase: 'open', refusal: null, amount: null, on: TODAY },
      };
    case 'mark_paid_earlier':
      return {
        ...base,
        form: {
          id: bloom,
          from: 'card',
          phase: 'open',
          refusal: null,
          amount: null,
          on: EARLIER_DAY,
        },
      };
    case 'marked_paid':
      return {
        ...base,
        ledger: paidBy(base.ledger, bloom, 'Folake Adeyemi', TODAY, amountDue(bloom)),
        marked: [bloom],
      };
    case 'refused_paid':
      return {
        ...base,
        form: {
          id: bloom,
          from: 'card',
          phase: 'refused',
          refusal: 'paid',
          amount: null,
          on: TODAY,
        },
      };
    case 'refused_cancelled':
      return {
        ...base,
        form: {
          id: bloom,
          from: 'card',
          phase: 'refused',
          refusal: 'cancelled',
          amount: null,
          on: TODAY,
        },
      };
    case 'read_only':
      return { ...base, vendors: 'readOnly' };
    case 'payers':
      return { ...base, view: { page: 'payers' } };
    case 'payer_never_sent':
      return { ...base, view: { page: 'payer', key: 'couple' } };
    case 'long_name':
      return {
        ...base,
        view: { page: 'payer', key: 'obi' },
        longName: true,
        links: { ...LINKS, obi: 'notSent' },
      };
    case 'payer_opened':
      return { ...base, view: { page: 'payer', key: 'obi' } };
    case 'no_payers':
      return { ...base, view: { page: 'payers' }, payers: 'none' };
    case 'no_costs':
      return { ...base, view: { page: 'payers' }, payers: 'noCosts', costs: false };
    case 'payer_removed':
      return { ...base, view: { page: 'payers' }, removed };
    case 'offline':
      return { ...base, view: { page: 'payer', key: 'couple' }, link: 'offline' };
    case 'send_failed':
      return { ...base, view: { page: 'payer', key: 'couple' }, failed: 'couple' };
    case 'due_now':
    case 'due_changed':
    case 'due_done':
      return {
        ...base,
        dueNow: sheet(REMINDER.payments),
      };
    case 'due_marked':
      return {
        ...base,
        ledger: paidBy(base.ledger, bloom, 'Folake Adeyemi', TODAY, amountDue(bloom)),
        dueNow: sheet(REMINDER.payments, { marked: [bloom] }),
      };
    case 'due_refused':
      return {
        ...base,
        dueNow: sheet(REMINDER.payments, { refused: ['savour-deposit'] }),
      };
    case 'due_read_only':
      return {
        ...base,
        vendors: 'readOnly',
        dueNow: sheet(REMINDER.payments, { readOnly: true }),
      };
    case 'refused_currency':
      return refused('currency');
    case 'refused_plan':
      return refused('plan');
    case 'ceiling_categories_only':
      return { ...base, ceilings: { ...CEILINGS, whole: null } };
    case 'ceiling_live_set':
      return { ...base, ceilings: { ...CEILINGS, whole: null }, ceilingLive: 'set' };
    case 'ceiling_live_changed':
      return { ...base, ceilingLive: 'changed' };
    case 'ceiling_live_cleared':
      return { ...base, ceilingLive: 'cleared' };
    case 'reminder_overdue':
    case 'reminder_mixed':
      return { ...base, reminder: state === 'reminder_overdue' ? 'overdue' : 'mixed' };
    case 'payers_loading':
      return { ...base, view: { page: 'payers' }, figures: 'loading' };
    case 'payers_live':
      return { ...base, view: { page: 'payers' }, showLive: true };
    case 'payers_reconnecting':
      return { ...base, view: { page: 'payers' }, link: 'reconnecting' };
    case 'payers_never_loaded':
      return { ...base, view: { page: 'payers' }, figures: 'never', link: 'offline' };
    case 'payers_neither':
      return { ...base, view: { page: 'payers' }, payers: 'none', costs: false };
    case 'payer_renamed':
      return {
        ...base,
        view: payer('obi'),
        payerList: PAYERS.map((one) => (one.key === 'obi' ? { ...one, name: RENAMED } : one)),
      };
    case 'payer_needs_amounts':
      return {
        ...base,
        view: payer('funmi'),
        lines: withRate(LINES, FLAG.line, FLAG.now),
        payerList: flaggedPayers(),
        flagged: [FLAG.line],
      };
    case 'payer_not_priced':
      return {
        ...base,
        view: payer('couple'),
        payerList: PAYERS.map((one) =>
          one.key === 'couple'
            ? { ...one, covers: [...one.covers, { line: 'arch', share: 1 }] }
            : one,
        ),
      };
    case 'payer_paid_past':
      return {
        ...base,
        view: payer('obi'),
        ledger: PAID_PAST.reduce(
          (ledger, [id, amount]) => paidBy(ledger, id, COLLEAGUE, TODAY, amount),
          base.ledger,
        ),
      };
    case 'payer_passphrase':
      return { ...base, view: payer('obi'), passphrase: ['obi'] };
    case 'payer_all_revoked':
      return { ...base, view: payer('bakare'), links: { ...LINKS, bakare: 'revoked' } };
    default:
      return base;
  }
}

export type BudgetAction =
  | { type: 'openMark'; id: string; from: 'card' | 'dueNow' }
  | { type: 'sendMark'; amount: number; on: string }
  | { type: 'marked'; amount: number; reader: string; words: string }
  | { type: 'closeForm' }
  | { type: 'undo'; id: string; words: string }
  | { type: 'leave' }
  | { type: 'openDueNow'; ids: readonly string[] }
  | { type: 'liveChange'; words: string }
  | { type: 'closeDueNow' }
  | { type: 'duePaid'; id: string; reader: string; words: string }
  | { type: 'dueUndo'; id: string; words: string }
  | { type: 'reconnected' }
  | { type: 'washed' }
  | { type: 'view'; view: View }
  | { type: 'send'; key: PayerKey }
  | { type: 'linkMade'; key: PayerKey }
  | { type: 'told'; words: string | null }
  | { type: 'ceilingChanged'; words: string }
  | { type: 'payersChanged'; words: string }
  | { type: 'openReminder' };

/** Every row on the sheet paid or cancelled elsewhere, none marked here: "Nothing left to pay." heads it (sc-93, 7 Nov). */
export function dueNowSettled(sheet: DueNowSheet, ledger: Ledger): boolean {
  return sheet.marked.length === 0 && sheet.ids.every((id) => !isOwed(ledger, id));
}

/** Mark paid shows only with a connection, the figures current and `vendors` on (sc-93). */
export function canMark(m: BudgetModel): boolean {
  return m.link === 'live' && m.vendors === 'on' && m.figures === 'shown';
}

export function reduce(m: BudgetModel, action: BudgetAction): BudgetModel {
  switch (action.type) {
    case 'openMark':
      return {
        ...m,
        form: {
          id: action.id,
          from: action.from,
          phase: 'open',
          refusal: null,
          amount: null,
          on: TODAY,
        },
      };
    case 'sendMark':
      return m.form == null
        ? m
        : { ...m, form: { ...m.form, phase: 'sending', amount: action.amount, on: action.on } };
    case 'marked': {
      if (m.form == null) return m;
      const { id, from, on } = m.form;
      const ledger = paidBy(m.ledger, id, action.reader, on, action.amount);
      const words = action.words;
      if (from === 'dueNow' && m.dueNow != null)
        return {
          ...m,
          ledger,
          form: null,
          dueNow: { ...m.dueNow, marked: [...m.dueNow.marked, id] },
          told: told(words),
        };
      return { ...m, ledger, form: null, marked: [...m.marked, id], told: told(words) };
    }
    case 'closeForm':
      return { ...m, form: null };
    case 'undo':
      return {
        ...m,
        ledger: unpaid(m.ledger, action.id),
        marked: m.marked.filter((id) => id !== action.id),
        told: told(action.words),
      };
    case 'leave':
      return { ...m, marked: [] };
    case 'openDueNow':
      return {
        ...m,
        dueNow: {
          ids: action.ids,
          fromReminder: false,
          sent: REMINDER.sent,
          lastAbout: [],
          marked: [],
          refused: [],
          readOnly: m.vendors === 'readOnly',
        },
      };
    case 'closeDueNow':
      return { ...m, dueNow: null, form: m.form?.from === 'dueNow' ? null : m.form };
    case 'duePaid': {
      if (m.dueNow == null) return m;
      const payment = paymentOf(action.id);
      return {
        ...m,
        ledger: paidBy(m.ledger, action.id, action.reader, TODAY, payment.amount),
        dueNow: { ...m.dueNow, marked: [...m.dueNow.marked, action.id] },
        told: told(action.words),
      };
    }
    case 'dueUndo':
      return m.dueNow == null
        ? m
        : {
            ...m,
            ledger: unpaid(m.ledger, action.id),
            dueNow: { ...m.dueNow, marked: m.dueNow.marked.filter((id) => id !== action.id) },
            told: told(action.words),
          };
    case 'reconnected':
      return { ...m, link: 'live', showLive: true };
    case 'washed':
      return { ...m, wash: null, washed: [] };
    case 'liveChange':
      return {
        ...m,
        lines: withRate(m.lines, LIVE_CHANGE.line, LIVE_CHANGE.to),
        wash: 'rate',
        liveLine: true,
        told: told(action.words),
      };
    case 'view':
      return { ...m, view: action.view, removed: null, failed: null, scrolled: false };
    case 'send':
      return { ...m, sending: action.key, failed: null };
    case 'linkMade':
      return {
        ...m,
        sending: null,
        links: {
          ...m.links,
          [action.key]:
            m.links[action.key] === 'notSent' || m.links[action.key] === 'revoked'
              ? 'sent'
              : m.links[action.key],
        },
      };
    case 'told':
      return { ...m, told: action.words == null ? null : told(action.words) };
    case 'ceilingChanged':
      return m.ceilingLive == null
        ? m
        : {
            ...m,
            ceilings: ceilingsAfter(m.ceilingLive),
            ceilingLive: null,
            wash: 'ceiling',
            showLive: true,
            news: action.words,
            told: told(action.words),
          };
    case 'payersChanged': {
      const shared = roomShared();
      return {
        ...m,
        payerList: shared.payers,
        vendorPayers: shared.vendorPayers,
        wash: 'payers',
        washed: ['obi', 'bakare'],
        news: action.words,
        told: told(action.words),
      };
    }
    case 'openReminder':
      return m.reminder == null ? m : { ...m, reminder: null, dueNow: reminderSheet(m.reminder) };
  }
}

let toldCount = 0;

function told(words: string): { words: string; at: number } {
  toldCount += 1;
  return { words, at: toldCount };
}

export const EVENT = EVENT_NAME;
