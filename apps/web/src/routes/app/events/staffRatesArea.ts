import {
  type StaffHeadline,
  type StaffOwnRate,
  type StaffRate,
  type StaffRateChanged,
  type StaffRateJob,
  type StaffRateKind,
  type StaffUnrated,
} from '@soirely/api-client';
import {
  type MoneyLanguage,
  amountExample,
  listFormat,
  minorDigits,
  readAmount,
  typedAmount,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { amountOfMinor, minorMoney, minorOf, priceProblem, wholeMoney } from './budgetArea.ts';

/** What this tab changed itself, so the row can say "Changed by you just now" with what it was. */
export interface MineChanged {
  was: StaffRate | null;
  removed: boolean;
}

export const jobKey = (id: string) => `job:${id}`;
export const ownKey = (memberId: string) => `own:${memberId}`;

export function hoursWords(t: TFunction, minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0
    ? t('staffRates.hours', { hours })
    : t('staffRates.hoursMinutes', { hours, minutes: rest });
}

/** A figure in words: whole when it has no pence, with them when it has. */
export function figure(amount: string, currency: string, locale: string): string {
  return minorOf(amount, currency) % 10 ** minorDigits(currency) === 0
    ? wholeMoney(amount, currency, locale)
    : minorMoney(amount, currency, locale);
}

export function rateText(t: TFunction, rate: StaffRate, currency: string, locale: string): string {
  const amount = figure(rate.amount, currency, locale);

  return rate.kind === 'hourly'
    ? t('staffRates.anHour', { amount })
    : t('staffRates.eachPerson', { amount });
}

const listed = (names: readonly string[], locale: string) =>
  listFormat(locale, { style: 'long', type: 'conjunction' }).format(names);

export function unratedLine(
  t: TFunction,
  unrated: readonly StaffUnrated[],
  locale: string,
): string | null {
  if (unrated.length === 0) return null;
  const names = unrated.map((one) =>
    t('staffRates.jobsHours', { job: one.job.name, hours: hoursWords(t, one.minutes) }),
  );

  return t('staffRates.notCounted', { names: listed(names, locale), count: unrated.length });
}

export function headlineLine(t: TFunction, head: StaffHeadline, locale: string): string {
  const from = t('staffRates.from', {
    counted: hoursWords(t, head.countedMinutes),
    scheduled: hoursWords(t, head.scheduledMinutes),
  });
  const unrated = unratedLine(t, head.unrated, locale);

  return unrated == null ? from : `${from} ${unrated}`;
}

export function biggestUnrated(head: StaffHeadline): StaffUnrated | undefined {
  return head.unrated.reduce<StaffUnrated | undefined>(
    (most, one) => (most == null || one.minutes > most.minutes ? one : most),
    undefined,
  );
}

export function sourceLine(t: TFunction, job: StaffRateJob): string {
  if (job.shifts === 0) return t('staffRates.noShifts');
  const hours = t('staffRates.fromShifts', {
    hours: hoursWords(t, job.scheduledMinutes),
    count: job.shifts,
  });

  return job.openPlaces === 0
    ? hours
    : `${hours} · ${t('staffRates.notFilled', { count: job.openPlaces })}`;
}

export function flatLine(t: TFunction, job: StaffRateJob): string {
  if (job.shifts === 0) return t('staffRates.noShifts');
  const parts = [
    t('staffRates.fromShifts', { hours: hoursWords(t, job.scheduledMinutes), count: job.shifts }),
  ];
  if (job.people > 0) parts.push(t('staffRates.people', { count: job.people }));
  if (job.openPlaces > 0) parts.push(t('staffRates.notFilled', { count: job.openPlaces }));

  return parts.join(' · ');
}

export function changedWords(
  t: TFunction,
  changed: StaffRateChanged | null,
  mine: MineChanged | undefined,
  currency: string,
  locale: string,
): string | null {
  if (mine != null) {
    if (mine.was == null) return t('staffRates.setByYou');
    const was = rateText(t, mine.was, currency, locale);

    return mine.removed
      ? t('staffRates.removedByYou', { was })
      : t('staffRates.changedByYou', { was });
  }
  if (changed == null) return null;
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(changed.at));

  return changed.by == null
    ? t('staffRates.setOn', { day })
    : t('staffRates.setBy', { who: changed.by, day });
}

/** A rate typed in the reader's format, in the event's currency's minor unit; null when it is not one. */
export function typedMinor(
  typed: string,
  language: MoneyLanguage,
  currency: string,
): { amount: string; minor: number } | null {
  const amount = readAmount(typed, language, currency);

  return amount == null ? null : { amount, minor: minorOf(amount, currency) };
}

export function typedOf(rate: StaffRate | null, language: MoneyLanguage, currency: string): string {
  if (rate == null) return '';
  const digits = minorDigits(currency);
  const typed = typedAmount(rate.amount, language, currency);

  return digits > 0 && minorOf(rate.amount, currency) % 10 ** digits === 0
    ? typed.slice(0, typed.length - digits - 1)
    : typed;
}

/** The checks before sending: required, 0 or more, numbers only, and no more decimals than the currency has. 0 is a rate. */
export function rateProblem(
  t: TFunction,
  typed: string,
  kind: StaffRateKind,
  language: MoneyLanguage,
  currency: string,
): string | null {
  const fee = kind === 'flat';
  const text = typed.trim();
  if (text.startsWith('-') && priceProblem(text.slice(1), language, currency) !== 'number')
    return t(fee ? 'staffRates.negativeFee' : 'staffRates.negativeRate');
  const problem = priceProblem(text, language, currency);
  if (problem == null) return null;
  if (problem === 'blank') return t(fee ? 'staffRates.blankFee' : 'staffRates.blankRate');
  if (problem === 'decimals')
    return t(fee ? 'staffRates.decimalsFee' : 'staffRates.decimalsRate', {
      example: amountExample(language, currency),
    });

  return t(fee ? 'staffRates.numberFee' : 'staffRates.numberRate');
}

const hourlyMinor = (minor: number, minutes: number) => Math.round((minor * minutes) / 60);

/** The sum under the field as the rate is typed: the hours or fees it applies to, times the rate. */
export function insetWords(
  t: TFunction,
  job: StaffRateJob,
  kind: StaffRateKind,
  minor: number | null,
  currency: string,
  locale: string,
): string | null {
  if (minor == null) return null;
  const at = (value: number) => figure(amountOfMinor(value, currency), currency, locale);
  const keeps =
    job.keepOwn.length === 0
      ? ''
      : ` ${t('staffRates.keepOwn', { names: listed(job.keepOwn, locale), count: job.keepOwn.length })}`;
  if (kind === 'hourly')
    return `${t('staffRates.sum', {
      quantity: hoursWords(t, job.rateMinutes),
      rate: at(minor),
      amount: at(hourlyMinor(minor, job.rateMinutes)),
    })}${keeps}`;
  const parts = [
    t('staffRates.sum', {
      quantity: t('staffRates.fees', { count: job.fees }),
      rate: at(minor),
      amount: at(job.fees * minor),
    }),
  ];
  if (job.paidOnce.length > 0)
    parts.push(
      t('staffRates.oncePaid', {
        names: listed(job.paidOnce, locale),
        count: job.paidOnce.length,
      }),
    );
  if (job.openPlaces > 0) parts.push(t('staffRates.openFees', { count: job.openPlaces }));

  return `${parts.join(' ')}${keeps}`;
}

/** A person's own rate as typed: their hours at it, or one fee once they have a shift. */
export function ownInset(
  t: TFunction,
  minutes: number,
  kind: StaffRateKind,
  minor: number | null,
  currency: string,
  locale: string,
): string | null {
  if (minor == null) return null;
  const at = (value: number) => figure(amountOfMinor(value, currency), currency, locale);
  if (kind === 'hourly')
    return t('staffRates.sum', {
      quantity: hoursWords(t, minutes),
      rate: at(minor),
      amount: at(hourlyMinor(minor, minutes)),
    });
  const fees = minutes > 0 ? 1 : 0;

  return t('staffRates.sum', {
    quantity: t('staffRates.fees', { count: fees }),
    rate: at(minor),
    amount: at(fees * minor),
  });
}

export function ownLines(
  t: TFunction,
  own: StaffOwnRate,
  jobRate: StaffRate | null,
  currency: string,
  locale: string,
): string[] {
  return [
    t('staffRates.instead', {
      rate: rateText(t, own.rate, currency, locale),
      job: own.job.name,
      jobRate: jobRate == null ? t('staffRates.noRateYet') : rateText(t, jobRate, currency, locale),
    }),
    t('staffRates.ownHours', { hours: hoursWords(t, own.minutes), job: own.job.name }),
  ];
}
