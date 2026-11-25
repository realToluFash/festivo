import { ApiError, type OpenedDoorCode } from '@soirely/api-client';
import { formatDay, formatEventDate, formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import type { TFunction } from 'i18next';

export const DOOR_CODE_LENGTH = 8;

export type CodeLine = 'blank' | 'short' | 'refused' | 'failed';

/** A door code as typed: any case, spaces and hyphens ignored (sc-72). */
export function normalCode(typed: string): string {
  return typed.replace(/[\s-]/gu, '').toUpperCase();
}

/** The form check before anything is sent: required, and 8 letters and numbers once spaces and hyphens are gone. */
export function codeProblem(typed: string): 'blank' | 'short' | null {
  const plain = normalCode(typed);
  if (plain === '') return 'blank';

  return /^[A-Z0-9]+$/u.test(plain) && plain.length === DOOR_CODE_LENGTH ? null : 'short';
}

export function nameProblem(name: string): boolean {
  return name.trim() === '';
}

export type TooMany = { kind: 'tooMany'; lifts: Date | null; words: string };

export type Opening =
  | { kind: 'event'; code: string; opened: OpenedDoorCode }
  | { kind: 'member'; organisation: string; eventId: string }
  | TooMany
  | { kind: 'enter'; line: CodeLine };

/** Where an opened code leads: its event, or the member's refusal (sc-71's `already_a_member`). */
export function openedTo(code: string, opened: OpenedDoorCode): Opening {
  return opened.standing === 'member'
    ? { kind: 'member', organisation: opened.event.organisation, eventId: opened.event.id }
    : { kind: 'event', code, opened };
}

/** A failed open: too many tries, the one refusal (404 for every bad code), or the way there failing. */
export function refusedTo(error: unknown, now: Date = new Date()): Opening {
  if (error instanceof ApiError && error.status === 429) return tooManyOf(error, now);

  return {
    kind: 'enter',
    line: error instanceof ApiError && error.status === 404 ? 'refused' : 'failed',
  };
}

export type JoinRefusal =
  { kind: 'member' } | TooMany | { kind: 'trouble'; trouble: 'refused' | 'failed' };

/** A failed Join: the member's 409, too many tries, the one refusal for a code that filled or stopped meanwhile, or the way there failing. */
export function joinRefusal(error: unknown, now: Date = new Date()): JoinRefusal {
  if (error instanceof ApiError && error.status === 409) return { kind: 'member' };
  if (error instanceof ApiError && error.status === 429) return tooManyOf(error, now);

  return {
    kind: 'trouble',
    trouble: error instanceof ApiError && error.is('door_code_invalid') ? 'refused' : 'failed',
  };
}

function tooManyOf(error: ApiError, now: Date): TooMany {
  return {
    kind: 'tooMany',
    lifts: lockLiftsAt(Number(error.response?.headers.get('Retry-After')), now),
    words: error.problem.detail ?? error.problem.title,
  };
}

/** "Try again at 13:32.", on the reader's clock, with the day only when it is not today's. */
export function tryAgainWords(
  t: TFunction,
  tooMany: TooMany,
  locale: string,
  now: Date = new Date(),
): string {
  const { lifts } = tooMany;
  if (lifts == null) return tooMany.words;
  const time = formatTimeOfDay(lifts, locale);
  const when =
    lifts.toDateString() === now.toDateString() ? time : `${formatDay(lifts, locale)} ${time}`;

  return t('redeem.tryAt', { when });
}

/** "Sat 14 Nov · Lumen Feiras · Can check guests in · Bar and drinks", the day on the event's clock. */
export function eventLine(t: TFunction, opened: OpenedDoorCode, locale: string): string {
  return [
    formatEventDate(opened.event.startsAt, opened.event.timeZone, locale, false),
    opened.event.organisation,
    t(`eventPeople.role.${opened.role}`),
    opened.jobLabel,
  ]
    .filter((part) => part != null && part !== '')
    .join(' · ');
}
