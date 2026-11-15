import type { Guest, OrganisationEvent } from '@soirely/api-client';
import {
  type Counts,
  REPLY_KEY,
  type ReplyWord,
  formatWallClock,
  formatWallDay,
  replyDate,
  wallDay,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

export const CLOSES_AT = '23:59';

export type ReplyByAsk = 'sooner' | 'now';

type ReplyDated = Pick<OrganisationEvent, 'replyBy' | 'repliesCloseAt' | 'repliesClosedOn'>;

export function todayIn(now: Date, timeZone: string): string {
  return wallDay(now, timeZone);
}

export function dayBefore(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);

  return day.toISOString().slice(0, 10);
}

export function replyByWrong(date: string | null, startDate: string): boolean {
  return date != null && date >= startDate;
}

export function replyByAfterStart(replyBy: string | null, startDate: string): string | null {
  return replyBy != null && startDate <= replyBy ? dayBefore(startDate) : null;
}

/** Closing replies sooner asks first, and only while somebody has still to reply: a past day closes them now. */
export function replyByAsk(
  saved: string | null,
  next: string | null,
  today: string,
  havent: number,
): ReplyByAsk | null {
  if (next == null || havent === 0) return null;
  if (next < today) return 'now';
  if (saved != null && next < saved) return 'sooner';

  return null;
}

/** The one rule of 8 Nov: closed from 23:59:59 on the Reply by day, at once after Close replies now. */
export function repliesClosed(event: ReplyDated, now: Date): boolean {
  if (event.repliesClosedOn != null) return true;
  if (event.repliesCloseAt == null) return false;

  return now.getTime() >= Date.parse(event.repliesCloseAt);
}

/** The day replies closed: the save's when a save closed them, else the Reply by day itself. */
export function closedOn(event: ReplyDated, now: Date): string | null {
  if (!repliesClosed(event, now)) return null;

  return event.repliesClosedOn ?? event.replyBy ?? null;
}

function shortDay(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function longDay(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function replyByRow(
  event: ReplyDated & Pick<OrganisationEvent, 'timeZone'>,
  locale: string,
  now: Date,
  t: TFunction,
): { title: string; line: string } {
  const date = event.replyBy ?? null;
  if (date == null) return { title: t('replyBy.none'), line: t('replyBy.label') };

  return {
    title: shortDay(date, locale),
    line: repliesClosed(event, now)
      ? t('replyBy.rowClosed')
      : t('replyBy.rowCloses', {
          time: formatWallClock(CLOSES_AT, locale),
          zone: event.timeZone,
        }),
  };
}

export function replyByHint(timeZone: string, locale: string, t: TFunction): string {
  return t('replyBy.hint', { time: formatWallClock(CLOSES_AT, locale), zone: timeZone });
}

export function replyByPreview(
  date: string | null,
  today: string,
  locale: string,
  t: TFunction,
): string | null {
  if (date == null || date < today) return null;

  return t('replyBy.onGuestsPage', {
    sentence: t('replyBy.pleaseAnswerBy', { date: longDay(date, locale) }),
  });
}

/** One toast wherever the save came from (l10n, #33572): a past day closed replies at the save. */
export function replyBySaved(
  date: string | null,
  timeZone: string,
  locale: string,
  now: Date,
  t: TFunction,
): string {
  if (date == null) return t('replyBy.savedRemoved');
  if (date < todayIn(now, timeZone)) return t('replyBy.savedClosedNow');

  return t('replyBy.saved', {
    date: formatWallDay(date, locale),
    time: formatWallClock(CLOSES_AT, locale),
    zone: timeZone,
  });
}

export function replyByMoves(replyBy: string, moved: string, locale: string, t: TFunction): string {
  return t('replyBy.moves', {
    old: formatWallDay(replyBy, locale),
    next: formatWallDay(moved, locale),
  });
}

/** Guests' card's own count sentence (l10n, #33419), never a copy of it. */
export function haventLine(t: TFunction, counts: Counts): string {
  if (counts.havent === 0) return t('guestList.everyoneReplied');
  const havent = t('guestList.havent', { count: counts.havent });

  return counts.haventCompanions === 0
    ? t('guestList.haventLine', { havent })
    : t('guestList.haventWho', {
        havent,
        guests: t('guestList.countGuests', { count: counts.haventGuests }),
        companions: t('guestList.countCompanions', { count: counts.haventCompanions }),
      });
}

export function replyByAskWords(
  ask: ReplyByAsk,
  date: string,
  counts: Counts | null,
  locale: string,
  t: TFunction,
): { title: string; line: string; confirm: string } {
  const after = ask === 'now' ? t('replyBy.closeNowLine') : t('replyBy.closeSoonerLine');

  return {
    title:
      ask === 'now'
        ? t('replyBy.closeNowTitle')
        : t('replyBy.closeSoonerTitle', { date: formatWallDay(date, locale) }),
    line: counts == null ? after : t('replyBy.askLine', { count: haventLine(t, counts), after }),
    confirm: ask === 'now' ? t('replyBy.closeNow') : t('replyBy.closeSooner'),
  };
}

export interface GuestReplies {
  replyBy: string | null;
  closedOn: string | null;
}

export function guestRepliesOf(event: ReplyDated, now: Date): GuestReplies {
  return { replyBy: event.replyBy ?? null, closedOn: closedOn(event, now) };
}

export function askedBy(
  reply: ReplyWord,
  replies: GuestReplies,
  locale: string,
  t: TFunction,
): string | null {
  return reply === 'maybe' && replies.replyBy != null
    ? t('guestList.askedByOn', { date: formatWallDay(replies.replyBy, locale) })
    : null;
}

export function guestReplyBy(
  guest: Pick<Guest, 'repliesReopened'>,
  reply: ReplyWord,
  replies: GuestReplies,
  manages: boolean,
  timeZone: string,
  locale: string,
  t: TFunction,
): { card: string | null; reopens: boolean; reply: string | null; asked: string | null } {
  const asked = askedBy(reply, replies, locale, t);
  const word = t(REPLY_KEY[reply]);
  const replyLine =
    asked == null
      ? null
      : t('guestList.askedBy', { reply: word, date: formatWallDay(replies.replyBy ?? '', locale) });
  const closed = replies.closedOn != null && reply !== 'notYetInvited';
  const reopened = guest.repliesReopened ?? null;

  if (!closed) return { card: null, reopens: false, reply: replyLine, asked };
  if (reopened != null)
    return {
      card: t('guestList.repliesReopened', {
        name: reopened.by,
        date: replyDate(reopened.at, timeZone, locale),
      }),
      reopens: false,
      reply: replyLine,
      asked,
    };

  const day = formatWallDay(replies.closedOn ?? '', locale, true);

  return {
    card: manages
      ? t('guestList.repliesClosedManage', { date: day })
      : t('guestList.repliesClosedOn', { date: day }),
    reopens: manages,
    reply: replyLine,
    asked,
  };
}
