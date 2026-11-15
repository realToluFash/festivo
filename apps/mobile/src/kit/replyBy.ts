import type { Guest, OrganisationEvent } from '@soirely/api-client';
import {
  type Counts,
  REPLY_KEY,
  type ReplyByAsk,
  type ReplyDated,
  type ReplyWord,
  closedOn,
  formatWallClock,
  formatWallDay,
  haventLine,
  repliesClosed,
  replyDate,
  wallDay,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

export const CLOSES_AT = '23:59';

export function todayIn(now: Date, timeZone: string): string {
  return wallDay(now, timeZone);
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
    line: counts == null ? after : t('replyBy.askLine', { havent: haventLine(t, counts), after }),
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
): {
  card: string | null;
  reopens: boolean;
  /** Record a reply is offered: to those who manage guests, while replies are open or reopened (sc-3787). */
  records: boolean;
  reply: string | null;
  asked: string | null;
} {
  const asked = askedBy(reply, replies, locale, t);
  const word = t(REPLY_KEY[reply]);
  const replyLine =
    asked == null
      ? null
      : t('guestList.askedBy', { reply: word, date: formatWallDay(replies.replyBy ?? '', locale) });
  const closed = replies.closedOn != null && reply !== 'notYetInvited';
  const reopened = guest.repliesReopened ?? null;
  const records = manages && reply !== 'notYetInvited' && (!closed || reopened != null);

  if (!closed) return { card: null, reopens: false, records, reply: replyLine, asked };
  if (reopened != null)
    return {
      card: t('guestList.repliesReopened', {
        name: reopened.by,
        date: replyDate(reopened.at, timeZone, locale),
      }),
      reopens: false,
      records,
      reply: replyLine,
      asked,
    };

  const day = formatWallDay(replies.closedOn ?? '', locale, true);

  return {
    card: manages
      ? t('guestList.repliesClosedManage', { date: day })
      : t('guestList.repliesClosedOn', { date: day }),
    reopens: manages,
    records,
    reply: replyLine,
    asked,
  };
}
