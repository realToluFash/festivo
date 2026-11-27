import type { StaffChange, StaffEntry, StaffReminder } from '@soirely/api-client';
import { clockText, formatEventClock, formatEventWeekday, wallDay } from '@soirely/domain';
import type { TFunction } from 'i18next';

/** A weekday can name two days of an event longer than this, so each carries its date too (sc-4333). */
const LONG_EVENT_MS = 7 * 86_400_000;

export interface NoticeClock {
  timeZone: string;
  locale: string;
  long: boolean;
}

export function noticeClock(
  event: { startsAt: string; endsAt: string; timeZone: string },
  locale: string,
): NoticeClock {
  return {
    timeZone: event.timeZone,
    locale,
    long: Date.parse(event.endsAt) - Date.parse(event.startsAt) > LONG_EVENT_MS,
  };
}

/** A time with its weekday unless it falls on the day of the time before it, as the shift lines of the message have it. */
export function slotWords(moment: string, before: string | null, clock: NoticeClock): string {
  if (before != null && wallDay(before, clock.timeZone) === wallDay(moment, clock.timeZone))
    return formatEventClock(moment, clock.timeZone, clock.locale);

  return clockText(
    new Intl.DateTimeFormat(clock.locale, {
      weekday: 'long',
      ...(clock.long ? { day: 'numeric', month: 'short' } : {}),
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: clock.timeZone,
    }),
    new Date(moment),
  );
}

/** A calendar day, `2026-10-16`, as "Friday, Oct 16". */
export function dayWords(day: string, locale: string): string {
  return formatEventWeekday(`${day}T12:00:00Z`, 'UTC', locale);
}

/** The Waiting line for one change; the More changes line belongs to the message alone, as the roster's lines are not capped. */
export function changeWords(change: StaffChange, clock: NoticeClock, t: TFunction): string | null {
  const at = (moment: string | null, before: string | null) =>
    moment == null ? '' : slotWords(moment, before, clock);

  switch (change.kind) {
    case 'start_time':
    case 'end_time':
      return t(change.kind === 'start_time' ? 'notices.start' : 'notices.end', {
        new: at(change.start, change.on ?? change.start),
        old: at(change.oldStart, change.on ?? change.start),
      });
    case 'shift_added':
    case 'shift_removed':
      return t(change.kind === 'shift_added' ? 'notices.assigned' : 'notices.unassigned', {
        start: at(change.start, null),
        end: at(change.end, change.start),
      });
    case 'shift_retimed':
      return t('notices.retimed', {
        start: at(change.start, null),
        end: at(change.end, change.start),
        oldStart: at(change.oldStart, change.start),
        oldEnd: at(change.oldEnd, change.oldStart),
      });
    case 'no_shift_left':
      return t('notices.noShift');
    case 'job':
      return t('notices.job', { new: change.new ?? '', old: change.old ?? '' });
    case 'venue':
      return t('notices.venue', { new: change.new ?? '', old: change.old ?? '' });
    case 'date':
      return t('notices.date', {
        new: change.new == null ? '' : dayWords(change.new, clock.locale),
        old: change.old == null ? '' : dayWords(change.old, clock.locale),
      });
    case 'more_changes':
      return null;
  }
}

export type NoticeMark = 'waiting' | 'told' | 'called_off' | 'ended';

/** The lines under the state word in the Briefing column; a change still waiting once the event is Finished sends nothing, so it is not shown. */
export function noticeLines(
  one: StaffEntry,
  finished: boolean,
  clock: NoticeClock,
  t: TFunction,
): { mark: NoticeMark | null; words: string }[] {
  const notice = one.notice;
  if (notice == null) return [];
  if (notice.state === 'told')
    return [
      {
        mark: 'told',
        words: t('notices.told', {
          date: formatEventWeekday(notice.at, clock.timeZone, clock.locale),
          time: formatEventClock(notice.at, clock.timeZone, clock.locale),
        }),
      },
      ...(notice.ending == null
        ? []
        : [
            {
              mark: notice.ending,
              words: notice.ending === 'called_off' ? t('notices.calledOff') : t('notices.ended'),
            },
          ]),
    ];
  if (finished) return [];

  return [
    {
      mark: 'waiting',
      words: t('notices.goesAt', {
        time: formatEventClock(notice.goesAt, clock.timeZone, clock.locale),
      }),
    },
    ...notice.changes.flatMap((change) => {
      const words = changeWords(change, clock, t);
      return words == null ? [] : [{ mark: null, words }];
    }),
    { mark: null, words: t('notices.sameMessage') },
  ];
}

/** The removal question's added line: only a person whose briefing went (sent, read, or changed since), whom a push reaches, before the event is Finished. */
export function removalLine(one: StaffEntry, finished: boolean, t: TFunction): string | null {
  if (finished || !one.inApp || one.briefing === 'none') return null;

  return t('notices.removal', { name: one.fullName });
}

export type ReminderCardLines =
  { kind: 'finished'; line: string } | { kind: 'open'; top: string | null; left: string[] };

/** Once the event is Finished, only the Sent line or why none goes; while the switch is off, nothing under what it does; once the last day's has gone, the Sent line alone. */
export function reminderLines(
  card: StaffReminder,
  locale: string,
  t: TFunction,
): ReminderCardLines {
  const sent =
    card.sent == null
      ? null
      : t('notices.sent', { date: dayWords(card.sent.date, locale), count: card.sent.count });

  if (card.concluded != null)
    return {
      kind: 'finished',
      line:
        sent ??
        (card.concluded === 'called_off' ? t('notices.noneCalledOff') : t('notices.noneEnded')),
    };
  if (!card.on) return { kind: 'open', top: null, left: [] };
  if (sent != null) return { kind: 'open', top: sent, left: [] };

  return {
    kind: 'open',
    top:
      card.next == null
        ? t('notices.nobody')
        : t('notices.next', { date: dayWords(card.next.date, locale), count: card.next.count }),
    left: [
      ...(card.notBriefed > 0 ? [t('notices.notBriefed', { count: card.notBriefed })] : []),
      ...(card.unreachable > 0 ? [t('notices.cannotReach', { count: card.unreachable })] : []),
    ],
  };
}
