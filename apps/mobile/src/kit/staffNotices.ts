import {
  ApiError,
  type StaffChange,
  type StaffEntry,
  type StaffReminder,
} from '@soirely/api-client';
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

export function dayWords(day: string, locale: string): string {
  return formatEventWeekday(`${day}T12:00:00Z`, 'UTC', locale);
}

/** The Waiting line for one change; the More changes line belongs to the message alone, as the roster's lines are not capped. */
export function changeWords(change: StaffChange, clock: NoticeClock, t: TFunction): string | null {
  const lineClock = change.dated ? { ...clock, long: true } : clock;
  const at = (moment: string | null, before: string | null) =>
    moment == null ? '' : slotWords(moment, before, lineClock);

  switch (change.kind) {
    case 'start_time':
    case 'end_time':
      return t(change.kind === 'start_time' ? 'staffNotices.start' : 'staffNotices.end', {
        new: at(change.start, change.on),
        old: at(change.oldStart, change.on),
      });
    case 'shift_added':
    case 'shift_removed':
      return t(
        change.kind === 'shift_added' ? 'staffNotices.assigned' : 'staffNotices.unassigned',
        {
          start: at(change.start, null),
          end: at(change.end, change.start),
        },
      );
    case 'shift_retimed':
      return t('staffNotices.retimed', {
        start: at(change.start, null),
        end: at(change.end, change.start),
        oldStart: at(change.oldStart, change.start),
        oldEnd: at(change.oldEnd, change.oldStart),
      });
    case 'no_shift_left':
      return t('staffNotices.noShift');
    case 'job':
      return t('staffNotices.job', { new: change.new ?? '', old: change.old ?? '' });
    case 'venue':
      return t('staffNotices.venue', { new: change.new ?? '', old: change.old ?? '' });
    case 'date':
      return t('staffNotices.date', {
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
        words: t('staffNotices.told', {
          date: formatEventWeekday(notice.at, clock.timeZone, clock.locale),
          time: formatEventClock(notice.at, clock.timeZone, clock.locale),
        }),
      },
      ...(notice.ending == null
        ? []
        : [
            {
              mark: notice.ending,
              words:
                notice.ending === 'called_off'
                  ? t('staffNotices.calledOff')
                  : t('staffNotices.ended'),
            },
          ]),
    ];
  if (finished) return [];

  return [
    {
      mark: 'waiting',
      words: t('staffNotices.goesAt', {
        time: formatEventClock(notice.goesAt, clock.timeZone, clock.locale),
      }),
    },
    ...notice.changes.flatMap((change) => {
      const words = changeWords(change, clock, t);
      return words == null ? [] : [{ mark: null, words }];
    }),
    { mark: null, words: t('staffNotices.sameMessage') },
  ];
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
      : t('staffNotices.sent', { date: dayWords(card.sent.date, locale), count: card.sent.count });

  if (card.concluded != null)
    return {
      kind: 'finished',
      line:
        sent ??
        (card.concluded === 'called_off'
          ? t('staffNotices.noneCalledOff')
          : t('staffNotices.noneEnded')),
    };
  if (!card.on) return { kind: 'open', top: null, left: [] };
  if (sent != null) return { kind: 'open', top: sent, left: [] };

  return {
    kind: 'open',
    top:
      card.next == null
        ? t('staffNotices.nobody')
        : t('staffNotices.next', {
            date: dayWords(card.next.date, locale),
            count: card.next.count,
          }),
    left: [
      ...(card.notBriefed > 0 ? [t('staffNotices.notBriefed', { count: card.notBriefed })] : []),
      ...(card.unreachable > 0 ? [t('staffNotices.cannotReach', { count: card.unreachable })] : []),
    ],
  };
}

export type FlipResult =
  | { kind: 'saved'; card: StaffReminder }
  | { kind: 'failed'; card: StaffReminder }
  | { kind: 'over'; card: StaffReminder };

export async function flipReminder(
  card: StaffReminder,
  next: boolean,
  save: (on: boolean) => Promise<StaffReminder>,
): Promise<FlipResult> {
  try {
    return { kind: 'saved', card: await save(next) };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'event_concluded')
      return { kind: 'over', card };

    return { kind: 'failed', card };
  }
}
