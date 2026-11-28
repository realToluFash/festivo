import type { Schedule } from '@soirely/api-client';
import {
  type RunFigure,
  type TodayRun,
  type TodayStopState,
  formatWallClock,
  roleHolds,
  runItemOf,
  timeSlot,
  todayRunOf,
  todayTrackParam,
  wallOfZoned,
  zonedAt,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

type ShownItem = Schedule['items'][number] & { planned: string };

export interface RunStop {
  time: string;
  title: string;
  state: TodayStopState;
}

/** Now from the run of show (sc-61017, by sc-29875), in words: the demo draws its sample in the same shape. */
export interface RunNow {
  headline: string;
  /** "until 17:30", "12 min over", or null for an item with no length and when nothing is Now. */
  until: string | null;
  /** What a screen reader says for the until line, when that is not its words. */
  untilSaid: string | null;
  figure: { words: string; said: string } | null;
  next: { time: string; title: string } | null;
  rail: RunStop[];
  railSaid: string;
  /** The followed track, as Open run of show names it to the Schedule. */
  track: string | null;
}

/** The event whose running order Today reads, or null for a role without run_of_show.read, whose Now stays the built one. */
export function runScheduleFor(
  event: { id: string; permissions: readonly string[] } | null,
): string | null {
  return event != null && roleHolds(event, 'run_of_show.read') ? event.id : null;
}

const STATE_KEY: Record<TodayStopState, string> = {
  done: 'today.railDone',
  now: 'today.railNow',
  next: 'today.railNext',
  later: 'today.railLater',
};

function figureOf(figure: RunFigure, t: TFunction): RunNow['figure'] {
  switch (figure.kind) {
    case 'done':
      return null;
    case 'last':
      return { words: t('runView.last'), said: t('runView.last') };
    case 'onTime':
      return { words: t('runView.onTime'), said: t('runView.onTime') };
    case 'behind':
      return {
        words: t('runView.behind', { count: figure.minutes }),
        said: t('today.runBehindSaid', { count: figure.minutes }),
      };
  }
}

export function railSaid(rail: readonly RunStop[], t: TFunction): string {
  return rail
    .map((stop) =>
      t('today.railStop', { time: stop.time, title: stop.title, state: t(STATE_KEY[stop.state]) }),
    )
    .join('; ');
}

const clockOf = (time: string, locale: string) => formatWallClock(wallOfZoned(time), locale);

/** Now's words for one followed track: the domain's `todayRunOf` decides everything shown. */
export function runNowWords(run: TodayRun<ShownItem>, locale: string, t: TFunction): RunNow {
  const { now, next } = run;
  let until: string | null = null;
  let untilSaid: string | null = null;

  if (now?.until != null) {
    if (now.over > 0) {
      until = t('today.runOver', { count: now.over });
      untilSaid = t('today.runOverSaid', { count: now.over });
    } else {
      until = t('today.runUntil', timeSlot(now.until, locale));
    }
  }

  const rail = run.rail.map<RunStop>(({ item, state }) => ({
    time: clockOf(item.planned, locale),
    title: item.title,
    state,
  }));

  return {
    headline: now?.item.title ?? (next == null ? t('night.everything') : t('night.nothingOn')),
    until,
    untilSaid,
    figure: figureOf(run.figure, t),
    next: next == null ? null : { time: clockOf(next.expected, locale), title: next.item.title },
    rail,
    railSaid: railSaid(rail, t),
    track: todayTrackParam(run.track),
  };
}

/** Now from the event's schedule at `at`, or null when the event day on now has no running order. */
export function runNowOf(
  schedule: Schedule,
  at: Date,
  locale: string,
  t: TFunction,
): RunNow | null {
  const run = todayRunOf(
    schedule.items.map(runItemOf),
    zonedAt(at, schedule.timeZone),
    schedule.timeZone,
  );

  return run == null ? null : runNowWords(run, locale, t);
}
