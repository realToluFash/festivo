import {
  ApiError,
  type BudgetLine,
  type DuePayment,
  type EventQuote,
  type OfferedVendor,
  type ScheduledPayment,
} from '@soirely/api-client';
import {
  type MoneyLanguage,
  listFormat,
  minorDigits,
  readAmount,
  typedAmount,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { amountOfMinor, lineState, minorMoney, minorOf, wholeMoney } from './budgetArea.ts';

export const DUE_NEXT = 3;

export const QUOTE_LIMITS = { covers: 500, reference: 64, description: 100 } as const;

export type Difference = 'matches' | 'short' | 'over';

/** The API's difference is scheduled less quoted: below zero while part of the quote is not scheduled. */
export function differenceOf(quote: EventQuote): Difference {
  const difference = Number(quote.difference);

  return difference === 0 ? 'matches' : difference < 0 ? 'short' : 'over';
}

function gapOf(quote: EventQuote, currency: string): string {
  return amountOfMinor(Math.abs(minorOf(quote.difference, currency)), currency);
}

export function differenceLine(
  t: TFunction,
  quote: EventQuote,
  currency: string,
  locale: string,
): string {
  const gap = minorMoney(gapOf(quote, currency), currency, locale);

  switch (differenceOf(quote)) {
    case 'matches':
      return t('quotes.matches');
    case 'short':
      return t('quotes.short', { gap });
    case 'over':
      return t('quotes.over', { gap });
  }
}

export function differenceShort(
  t: TFunction,
  quote: EventQuote,
  currency: string,
  locale: string,
): string {
  const gap = minorMoney(gapOf(quote, currency), currency, locale);

  switch (differenceOf(quote)) {
    case 'matches':
      return t('quotes.matchesShort');
    case 'short':
      return t('quotes.shortShort', { gap });
    case 'over':
      return t('quotes.overShort', { gap });
  }
}

/** The card rounds the gap to whole units, but never to 0: a gap under one unit keeps its minor unit. */
export function cardGap(amount: string, currency: string, locale: string): string {
  return minorOf(amount, currency) < 10 ** minorDigits(currency)
    ? minorMoney(amount, currency, locale)
    : wholeMoney(amount, currency, locale);
}

export function cardDifference(
  t: TFunction,
  quote: EventQuote,
  currency: string,
  locale: string,
): string {
  const gap = cardGap(gapOf(quote, currency), currency, locale);

  switch (differenceOf(quote)) {
    case 'matches':
      return t('quotes.matches');
    case 'short':
      return t('quotes.short', { gap });
    case 'over':
      return t('quotes.over', { gap });
  }
}

export function shortDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}

export function longDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}

/** Today as a wall-clock day, YYYY-MM-DD, in the event's time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((one) => one.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

export type CardDue = 'cardOverdue' | 'cardDueToday' | 'cardDueTomorrow' | 'cardDueOn';

export function cardDue(payment: DuePayment, today: string): CardDue {
  if (payment.overdue || payment.dueOn < today) return 'cardOverdue';
  if (payment.dueOn === today) return 'cardDueToday';
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  return payment.dueOn === tomorrow.toISOString().slice(0, 10) ? 'cardDueTomorrow' : 'cardDueOn';
}

export function dueInOrder(due: readonly DuePayment[], locale: string): DuePayment[] {
  return [...due].sort(
    (a, b) =>
      a.dueOn.localeCompare(b.dueOn) ||
      a.vendor.localeCompare(b.vendor, locale, { sensitivity: 'accent' }),
  );
}

export function scheduleOf(quote: EventQuote): ScheduledPayment[] {
  return [...quote.payments].sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export function firstOverdue(quote: EventQuote): ScheduledPayment | null {
  return scheduleOf(quote).find((one) => one.overdue) ?? null;
}

export function vendorLine(t: TFunction, quote: EventQuote): string {
  const category = t(`vendors.categories.${quote.vendor.category}`);
  const contact = quote.vendor.contactName ?? '';

  return contact === '' ? category : t('quotes.vendorLine', { category, contact });
}

export function offered(
  vendors: readonly OfferedVendor[],
  typed: string,
  locale: string,
): OfferedVendor[] {
  const looked = typed.trim().toLocaleLowerCase(locale);

  return vendors.filter(
    (one) => !one.archived && one.name.toLocaleLowerCase(locale).includes(looked),
  );
}

export function linesWords(t: TFunction, quote: EventQuote, language: string): string {
  return quote.lines.length === 0
    ? t('quotes.noLines')
    : listFormat(language, { type: 'conjunction' }).format(quote.lines.map((one) => one.label));
}

export function agreedElsewhere(
  quotes: readonly EventQuote[],
  lineId: string,
  quoteId: string | null,
): string | null {
  return (
    quotes.find((one) => one.id !== quoteId && one.lines.some((line) => line.id === lineId))?.vendor
      .name ?? null
  );
}

export function lineLine(
  t: TFunction,
  line: BudgetLine,
  holder: string | null,
  locale: string,
): string {
  if (holder != null) return t('quotes.agreedIn', { vendor: holder });
  const category = t(`vendors.categories.${line.category}`);
  if (lineState(line) === 'notPriced') return t('quotes.notPricedLine', { category });
  const low = minorMoney(line.cost.confirmed, line.currency, locale);
  const high = minorMoney(line.cost.potential, line.currency, locale);

  return t('quotes.priced', {
    amount: low === high ? low : t('budget.range', { low, high }),
    category,
  });
}

/** A typed amount as the API takes it, or null unless it is a number above 0 in the currency's minor unit. */
export function sentAmount(
  typed: string,
  language: MoneyLanguage,
  currency: string,
): string | null {
  const read = readAmount(typed, language, currency);

  return read == null || Number(read) <= 0 ? null : read;
}

export function amountProblem(t: TFunction, language: MoneyLanguage, currency: string): string {
  const example = typedAmount(minorDigits(currency) === 0 ? '3500' : '3500.50', language, currency);

  return t('quotes.enterAmount', { example });
}

export const lengthOf = (typed: string): number => [...typed.trim()].length;

export type QuoteForm = 'add' | 'revise' | 'correct';

export interface QuoteDraft {
  vendorId: string;
  typed: string;
  covers: string;
  amount: string;
  quotedOn: string;
  reference: string;
  lineIds: readonly string[];
}

export type QuoteField = 'vendor' | 'covers' | 'amount' | 'quotedOn' | 'reference';
export type QuoteProblems = Partial<Record<QuoteField, string>>;

export const BLANK_QUOTE: QuoteDraft = {
  vendorId: '',
  typed: '',
  covers: '',
  amount: '',
  quotedOn: '',
  reference: '',
  lineIds: [],
};

export function draftOfQuote(
  quote: EventQuote,
  language: MoneyLanguage,
  currency: string,
): QuoteDraft {
  return {
    vendorId: quote.vendor.id,
    typed: quote.vendor.name,
    covers: quote.quote.covers,
    amount: typedAmount(quote.quote.amount, language, currency),
    quotedOn: quote.quote.quotedOn,
    reference: quote.quote.reference ?? '',
    lineIds: quote.lines.map((one) => one.id),
  };
}

export interface MoneyAt {
  language: MoneyLanguage;
  currency: string;
  today: string;
}

/** The form's own checks, before anything is sent: Revise checks the amount and the date, Correct the rest. */
export function quoteProblems(
  t: TFunction,
  draft: QuoteDraft,
  form: QuoteForm,
  at: MoneyAt,
  current: EventQuote | null = null,
): QuoteProblems {
  const problems: QuoteProblems = {};

  if (form === 'add' && draft.vendorId === '') problems.vendor = t('quotes.chooseTheVendor');

  if (form !== 'revise') {
    if (draft.covers.trim() === '') problems.covers = t('quotes.enterCovers');
    else if (lengthOf(draft.covers) > QUOTE_LIMITS.covers)
      problems.covers = t('quotes.coversTooLong', { max: QUOTE_LIMITS.covers });
    if (lengthOf(draft.reference) > QUOTE_LIMITS.reference)
      problems.reference = t('quotes.numberTooLong', { max: QUOTE_LIMITS.reference });
  }

  if (form !== 'correct') {
    const amount = sentAmount(draft.amount, at.language, at.currency);
    if (amount == null) problems.amount = amountProblem(t, at.language, at.currency);
    if (draft.quotedOn === '') problems.quotedOn = t('quotes.enterDateQuoted');
    else if (draft.quotedOn > at.today) problems.quotedOn = t('quotes.quotedAhead');
    if (
      form === 'revise' &&
      current != null &&
      amount != null &&
      problems.quotedOn == null &&
      minorOf(amount, at.currency) === minorOf(current.quote.amount, at.currency) &&
      draft.quotedOn === current.quote.quotedOn
    ) {
      problems.amount = t('quotes.reviseUnchanged');
      problems.quotedOn = t('quotes.reviseUnchanged');
    }
  }

  return problems;
}

export interface PaymentDraft {
  description: string;
  amount: string;
  dueOn: string;
}

export type PaymentField = keyof PaymentDraft;
export type PaymentProblems = Partial<Record<PaymentField, string>>;

export const BLANK_PAYMENT: PaymentDraft = { description: '', amount: '', dueOn: '' };

export function draftOfPayment(
  payment: ScheduledPayment,
  language: MoneyLanguage,
  currency: string,
): PaymentDraft {
  return {
    description: payment.description,
    amount: typedAmount(payment.amount, language, currency),
    dueOn: payment.dueOn,
  };
}

export function paymentProblems(
  t: TFunction,
  draft: PaymentDraft,
  quote: EventQuote,
  at: Omit<MoneyAt, 'today'>,
  locale: string,
): PaymentProblems {
  const problems: PaymentProblems = {};

  if (draft.description.trim() === '') problems.description = t('quotes.enterWhatFor');
  else if (lengthOf(draft.description) > QUOTE_LIMITS.description)
    problems.description = t('quotes.whatForTooLong', { max: QUOTE_LIMITS.description });
  if (sentAmount(draft.amount, at.language, at.currency) == null)
    problems.amount = amountProblem(t, at.language, at.currency);
  if (draft.dueOn === '') problems.dueOn = t('quotes.enterDateDue');
  else if (draft.dueOn < quote.quote.quotedOn)
    problems.dueOn = t('quotes.dueBeforeQuote', {
      vendor: quote.vendor.name,
      day: longDay(quote.quote.quotedOn, locale),
    });

  return problems;
}

/** Only the problems already shown, as they now stand: a field is not marked while it is still being filled. */
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

const QUOTE_PATHS: Readonly<Record<string, QuoteField>> = {
  vendorId: 'vendor',
  covers: 'covers',
  amount: 'amount',
  currency: 'amount',
  quotedOn: 'quotedOn',
  reference: 'reference',
};

const PAYMENT_PATHS: Readonly<Record<string, PaymentField>> = {
  description: 'description',
  amount: 'amount',
  currency: 'amount',
  dueOn: 'dueOn',
};

/** The API's violations, each beside its field; one with no field of its own, such as `lineIds`, goes to the top of the form. */
export function refusedAt<K extends string>(
  violations: Record<string, string>,
  paths: Readonly<Record<string, K>>,
): { fields: Partial<Record<K, string>>; top: string | null } {
  const fields: Partial<Record<K, string>> = {};
  let top: string | null = null;
  for (const [path, words] of Object.entries(violations)) {
    const field = paths[path];
    if (field != null) fields[field] ??= words;
    else top ??= words;
  }

  return { fields, top };
}

export const quoteRefusedAt = (violations: Record<string, string>) =>
  refusedAt(violations, QUOTE_PATHS);

export const paymentRefusedAt = (violations: Record<string, string>) =>
  refusedAt(violations, PAYMENT_PATHS);

export function budgetPath(eventId: string): string {
  return `/app/events/${encodeURIComponent(eventId)}/budget`;
}

export function vendorPagePath(eventId: string, vendorId: string): string {
  return `${budgetPath(eventId)}/vendors/${encodeURIComponent(vendorId)}`;
}

export type BudgetView =
  { kind: 'home' } | { kind: 'due' } | { kind: 'vendor'; vendorId: string } | { kind: 'unknown' };

export function budgetView(rest: string): BudgetView {
  const parts = rest.split('/').filter((one) => one !== '');
  if (parts.length === 0) return { kind: 'home' };
  if (parts.length === 1 && parts[0] === 'due') return { kind: 'due' };
  if (parts.length === 2 && parts[0] === 'vendors' && parts[1] != null)
    return { kind: 'vendor', vendorId: parts[1] };

  return { kind: 'unknown' };
}

export const PAID_LIMITS = { reference: 100, reason: 200, description: 100 } as const;

export interface MarkDraft {
  amount: string;
  paidOn: string;
  reference: string;
}

export type MarkField = keyof MarkDraft;
export type MarkProblems = Partial<Record<MarkField, string>>;

/** The amount scheduled, and today in the event's time zone. */
export function draftToMark(
  payment: ScheduledPayment,
  language: MoneyLanguage,
  currency: string,
  today: string,
): MarkDraft {
  return { amount: typedAmount(payment.amount, language, currency), paidOn: today, reference: '' };
}

export function markProblems(t: TFunction, draft: MarkDraft, at: MoneyAt): MarkProblems {
  const problems: MarkProblems = {};

  if (sentAmount(draft.amount, at.language, at.currency) == null)
    problems.amount = amountProblem(t, at.language, at.currency);
  if (draft.paidOn === '') problems.paidOn = t('quotes.datePaidBlank');
  else if (draft.paidOn > at.today) problems.paidOn = t('quotes.datePaidAhead');
  if (lengthOf(draft.reference) > PAID_LIMITS.reference)
    problems.reference = t('quotes.referenceTooLong', { count: PAID_LIMITS.reference });

  return problems;
}

export interface MadeDraft extends MarkDraft {
  quoteId: string;
  description: string;
}

export type MadeField = 'description' | MarkField;
export type MadeProblems = Partial<Record<MadeField, string>>;

/** The vendor's first quote for the event, before any revision. */
export function firstQuoteOn(quote: EventQuote): string {
  return quote.earlier.reduce(
    (first, one) => (one.quotedOn < first ? one.quotedOn : first),
    quote.quote.quotedOn,
  );
}

export function madeProblems(
  t: TFunction,
  draft: MadeDraft,
  quote: EventQuote | undefined,
  at: MoneyAt,
  locale: string,
): MadeProblems {
  const problems: MadeProblems = {};

  if (draft.description.trim() === '') problems.description = t('quotes.enterWhatItWasFor');
  else if (lengthOf(draft.description) > PAID_LIMITS.description)
    problems.description = t('quotes.descriptionTooLong', { count: PAID_LIMITS.description });
  const marked = markProblems(t, draft, at);
  if (marked.amount != null) problems.amount = marked.amount;
  if (marked.paidOn != null) problems.paidOn = marked.paidOn;
  else if (quote != null && draft.paidOn < firstQuoteOn(quote))
    problems.paidOn = t('quotes.beforeFirstQuote', {
      vendor: quote.vendor.name,
      day: longDay(firstQuoteOn(quote), locale),
    });
  if (marked.reference != null) problems.reference = marked.reference;

  return problems;
}

export interface MadeTotals {
  paid: string;
  scheduled: string;
}

export interface MadeInset {
  now: MadeTotals;
  after: MadeTotals | null;
  /** How far Scheduled after the payment runs past the current quote; null at or under it. */
  over: string | null;
}

/** A preview of the vendor's totals: what the page shows after Add as paid is the server's arithmetic. */
export function madeInset(quote: EventQuote, amount: string | null, currency: string): MadeInset {
  const now = { paid: quote.paid, scheduled: quote.scheduled };
  if (amount == null) return { now, after: null, over: null };
  const added = minorOf(amount, currency);
  const scheduled = minorOf(quote.scheduled, currency) + added;
  const gap = scheduled - minorOf(quote.quote.amount, currency);

  return {
    now,
    after: {
      paid: amountOfMinor(minorOf(quote.paid, currency) + added, currency),
      scheduled: amountOfMinor(scheduled, currency),
    },
    over: gap > 0 ? amountOfMinor(gap, currency) : null,
  };
}

export function reasonProblem(t: TFunction, why: string): string | null {
  return lengthOf(why) > PAID_LIMITS.reason
    ? t('quotes.reasonTooLong', { count: PAID_LIMITS.reason })
    : null;
}

/** Paid against scheduled, in words, or null when they match. */
export function paidDifference(
  t: TFunction,
  scheduled: string,
  paid: string,
  currency: string,
  locale: string,
): string | null {
  const gap = minorOf(paid, currency) - minorOf(scheduled, currency);
  if (gap === 0) return null;
  const words = minorMoney(amountOfMinor(Math.abs(gap), currency), currency, locale);

  return gap > 0 ? t('quotes.moreThan', { gap: words }) : t('quotes.lessThan', { gap: words });
}

export function paidLine(
  t: TFunction,
  payment: ScheduledPayment,
  currency: string,
  locale: string,
): string {
  const { paid } = payment;
  if (paid == null) return '';
  const words = {
    amount: minorMoney(paid.amount, currency, locale),
    day: shortDay(paid.paidOn, locale),
  };
  const difference = paidDifference(t, payment.amount, paid.amount, currency, locale);
  if (paid.by == null)
    return difference == null
      ? t('quotes.paidLineNoName', words)
      : t('quotes.paidLineDifferenceNoName', { ...words, difference });

  return difference == null
    ? t('quotes.paidLine', { ...words, by: paid.by.name })
    : t('quotes.paidLineDifference', { ...words, difference, by: paid.by.name });
}

export function cancelledLine(
  t: TFunction,
  payment: ScheduledPayment,
  currency: string,
  locale: string,
): string {
  const amount = minorMoney(payment.amount, currency, locale);
  const why = payment.cancelled?.reason ?? null;

  return why == null
    ? t('quotes.cancelledLine', { amount })
    : t('quotes.cancelledLineWhy', { why, amount });
}

const MARK_PATHS: Readonly<Record<string, MadeField>> = {
  description: 'description',
  amount: 'amount',
  currency: 'amount',
  paidOn: 'paidOn',
  reference: 'reference',
};

export const paidRefusedAt = (violations: Record<string, string>) =>
  refusedAt(violations, MARK_PATHS);

export function focusFirstWrong(within: string): void {
  window.setTimeout(
    () => document.querySelector<HTMLElement>(`${within} [aria-invalid="true"]`)?.focus(),
    0,
  );
}

export function refusalWords(error: unknown, failed: string): string {
  return error instanceof ApiError && error.problem.detail != null && error.status !== 0
    ? error.problem.detail
    : failed;
}
