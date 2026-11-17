import type { Schedule } from '@soirely/api-client';
import {
  type RunFigure,
  type TodayRun,
  type TodayStopState,
  timeSlot,
  todayRunOf,
  roleHolds,
  todayTrackParam,
  zonedAt,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { clockOf, type NightShownItem, nightItemsOf } from './night.ts';

/** The event whose running order Today reads, or null for a role without run_of_show.read, whose Now stays sc-29090's. */
export function runScheduleFor(
  event: { id: string; permissions: readonly string[] } | null,
): string | null {
  return event != null && roleHolds(event, 'run_of_show.read') ? event.id : null;
}

export interface RunStop {
  time: string;
  title: string;
  state: TodayStopState;
}

/** Today's Now from the run of show (sc-29875), in words: the demo draws its sample in the same shape. */
export interface RunNow {
  happening: boolean;
  headline: string;
  /** "until 17:30", "12 min over", or null for an item with no length and when nothing is Now. */
  until: string | null;
  /** What a screen reader says for the until line, when that is not its words. */
  untilSaid?: string;
  figure: { words: string; said: string } | null;
  next: { time: string; title: string } | null;
  rail: RunStop[];
  railSaid: string;
  band: string;
  /** The followed track, as Open run of show names it to the night. */
  track?: string;
}

/** Each stop's label box on a rail `width` wide: centred on its stop, at most `widest`, pushed in so none overlap. */
export function railLabels(
  count: number,
  width: number,
  widest: number,
  apart: number,
): { left: number; width: number }[] {
  const box = Math.min(widest, (width - (count - 1) * apart) / count);
  const step = count > 1 ? width / (count - 1) : 0;

  return Array.from({ length: count }, (_, index) => ({
    left: Math.min(
      Math.max(index * step - box / 2, index * (box + apart)),
      width - (count - index) * box - (count - 1 - index) * apart,
    ),
    width: box,
  }));
}

const STATE_KEY: Record<TodayStopState, string> = {
  done: 'todayScreen.railDone',
  now: 'todayScreen.railNow',
  next: 'todayScreen.railNext',
  later: 'todayScreen.railLater',
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
        said: t('todayScreen.runBehindSaid', { count: figure.minutes }),
      };
  }
}

/** Now's words for one followed track: the domain's `todayRunOf` decides everything shown. */
export function runNowWords(
  name: string,
  run: TodayRun<NightShownItem>,
  locale: string,
  t: TFunction,
): RunNow {
  const { now, next } = run;
  const finished = now == null && next == null;
  let until: string | null = null;
  let untilSaid: string | undefined;

  if (now?.until != null) {
    if (now.over > 0) {
      until = t('todayScreen.runOver', { count: now.over });
      untilSaid = t('todayScreen.runOverSaid', { count: now.over });
    } else {
      until = t('todayScreen.runUntil', timeSlot(now.until, locale));
    }
  }

  const rail = run.rail.map<RunStop>(({ item, state }) => ({
    time: clockOf(item.planned, locale),
    title: item.title,
    state,
  }));

  return {
    happening: now != null,
    headline: now?.item.title ?? (finished ? t('night.everything') : t('runView.nothingNow')),
    until,
    ...(untilSaid == null ? {} : { untilSaid }),
    figure: figureOf(run.figure, t),
    next: next == null ? null : { time: clockOf(next.expected, locale), title: next.item.title },
    rail,
    railSaid: rail
      .map((stop) =>
        t('todayScreen.railStop', {
          time: stop.time,
          title: stop.title,
          state: t(STATE_KEY[stop.state]),
        }),
      )
      .join('; '),
    band:
      now == null
        ? t('todayScreen.liveName', { name })
        : until == null
          ? t('todayScreen.nowTitle', { title: now.item.title })
          : t('todayScreen.nowLine', { happening: now.item.title, until }),
    track: todayTrackParam(run.track),
  };
}

/** Now from the event's schedule at `at`, or null when the day on now has no running order. */
export function runNowOf(
  name: string,
  schedule: Schedule,
  at: Date,
  locale: string,
  t: TFunction,
): RunNow | null {
  const run = todayRunOf(nightItemsOf(schedule), zonedAt(at, schedule.timeZone), schedule.timeZone);

  return run == null ? null : runNowWords(name, run, locale, t);
}
