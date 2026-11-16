import { ApiError, type QueuedPress, type Schedule, type ScheduleItem } from '@soirely/api-client';
import {
  type LaterRow,
  type NightElapsed,
  type NightEnd,
  type NightHeader,
  type NightTrack,
  type NightView,
  endNowShows,
  formatWallClock,
  nightTracks,
  nightView,
  roleHolds,
  runItemOf,
  timeSlot,
  wallOfZoned,
  zonedAt,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

export type NightShownItem = ScheduleItem & { planned: string };

export type NightAction = 'startNow' | 'finishFirst' | 'none';

export interface NightLost {
  title: string;
  by: { name: string; at: string } | null;
}

function pressed(item: ScheduleItem, press: QueuedPress, at: string): ScheduleItem {
  if (press.kind === 'start') return { ...item, startedAt: at, endedAt: null, skipped: false };
  if (press.kind === 'done') return { ...item, startedAt: item.startedAt ?? at, endedAt: at };

  return { ...item, startedAt: null, endedAt: null, skipped: true };
}

/** The server's schedule with every press still waiting to send laid over it, oldest first. */
export function withPresses(schedule: Schedule, queue: readonly QueuedPress[]): Schedule {
  const items = queue.reduce(
    (all, press) =>
      all.map((item) =>
        item.id === press.itemId
          ? pressed(item, press, zonedAt(new Date(press.pressedAt), schedule.timeZone))
          : item,
      ),
    schedule.items,
  );

  return { ...schedule, items };
}

export function nightItemsOf(schedule: Schedule): NightShownItem[] {
  return schedule.items.map(runItemOf);
}

export function clockOf(time: string, locale: string): string {
  return formatWallClock(wallOfZoned(time), locale);
}

export function weekdayOf(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );
}

export function trackLabel(
  track: NightTrack<NightShownItem>,
  today: string,
  locale: string,
  t: TFunction,
): string {
  const place = track.place ?? t('runView.main');

  return track.day === today
    ? place
    : t('runView.trackOnDay', { place, day: weekdayOf(track.day, locale) });
}

/** Start now on Next or a chosen Later row: offered while nothing is on, the reason in its place while something is. */
export function startAction(view: NightView<NightShownItem>, manage: boolean): NightAction {
  if (!manage) return 'none';

  return view.now == null ? 'startNow' : 'finishFirst';
}

export function headerWords(header: NightHeader, t: TFunction): string | null {
  if (header.kind === 'onTime') return t('runView.onTime');
  if (header.kind === 'behind') return t('runView.behind', { count: header.minutes });

  return null;
}

export function subWords(view: NightView<NightShownItem>, locale: string, t: TFunction): string {
  const counts = { done: view.done, total: view.total };

  return view.endsAbout == null
    ? t('night.doneOf', counts)
    : t('night.doneOfEnds', { ...counts, ...timeSlot(view.endsAbout, locale) });
}

export function elapsedWords(elapsed: NightElapsed, t: TFunction): string {
  return elapsed.over > 0
    ? t('night.over', { count: elapsed.over })
    : t('runView.minutes', { count: elapsed.minutes });
}

export function lastsWords(item: NightShownItem, t: TFunction): string {
  return item.lengthMinutes == null
    ? t('runView.noLength')
    : t('night.lasts', { count: item.lengthMinutes });
}

export function ownerWords(item: NightShownItem, t: TFunction): string {
  return item.ownerName ?? t('night.noOwner');
}

export function nextTimes(
  next: NonNullable<NightView<NightShownItem>['next']>,
  locale: string,
  t: TFunction,
): { planned: string; about: string | null; said: string } {
  const planned = clockOf(next.planned, locale);

  if (next.expected == null) return { planned, about: null, said: planned };

  const slot = timeSlot(next.expected, locale);

  return {
    planned,
    about: t('runView.about', slot),
    said: t('night.plannedAbout', { planned, ...slot }),
  };
}

export function rowWords(row: LaterRow<NightShownItem>, locale: string, t: TFunction): string {
  if (row.mark === 'skipped' || row.at == null) return t('night.skipped');

  const slot = timeSlot(row.at, locale);

  return row.mark === 'done' ? t('night.rowDone', slot) : t('night.rowNotStarted', slot);
}

/** The end card's sentence and the line it was worked out from; neither for a track whose items were all skipped (pm, 16 Nov). */
export function endWords(
  end: NightEnd,
  locale: string,
  t: TFunction,
): { sentence: string | null; workedOut: string | null } {
  if (end.minutesLate == null || end.actualEnd == null || end.plannedEnd == null)
    return { sentence: null, workedOut: null };

  const late = end.minutesLate;

  return {
    sentence:
      late > 0
        ? t('night.behindPlan', { count: late })
        : late < 0
          ? t('night.aheadPlan', { count: -late })
          : t('night.onPlan'),
    workedOut: t('night.workedOut', {
      actual: clockOf(end.actualEnd, locale),
      planned: clockOf(end.plannedEnd, locale),
    }),
  };
}

export function lostWords(lost: NightLost, timeZone: string, locale: string, t: TFunction): string {
  if (lost.by == null) return t('night.notApplied');

  return t('night.alreadyStarted', {
    name: lost.by.name,
    ...timeSlot(zonedAt(new Date(lost.by.at), timeZone), locale),
  });
}

/** What the live region reads after a press, worked out from the night as the press leaves it. */
export function pressSaid(
  press: Pick<QueuedPress, 'kind' | 'itemId' | 'title'>,
  after: Schedule,
  trackKey: string,
  now: string,
  t: TFunction,
): string {
  if (press.kind === 'start') return t('night.started', { title: press.title });
  if (press.kind === 'skip') return t('night.skippedSaid', { title: press.title });

  const track = nightTracks(nightItemsOf(after), now).find((one) => one.key === trackKey);
  const next = track == null ? null : nightView(track, now, after.timeZone).next;

  return next == null
    ? t('night.doneSaid', { title: press.title })
    : t('night.doneNext', { title: press.title, next: next.item.title });
}

/** A network error, or the server failing: kept and tried again, not refused. */
export function isUnreachable(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status >= 500 || error.status === 429;
}

export function minutesOld(freshAt: Date, now: Date): number {
  return Math.max(1, Math.floor((now.getTime() - freshAt.getTime()) / 60_000));
}

/** End now (sc-3585) needs events.manage, not run_of_show.manage (pm, 1 Nov). */
export function endNowFor(
  items: readonly NightShownItem[],
  now: string,
  event: { permissions: readonly string[] },
  happening: boolean,
): boolean {
  return endNowShows(items, now, {
    happening,
    eventsManage: roleHolds(event, 'events.manage'),
    manage: true,
  });
}

export function pressLabels(
  title: string,
  t: TFunction,
): { done: string; skip: string; startNow: string; move: string } {
  return {
    done: t('night.doneNamed', { title }),
    skip: t('night.skipNamed', { title }),
    startNow: t('night.startNowNamed', { title }),
    move: t('night.moveNamed', { title }),
  };
}
