import type { ScheduleItem } from '@soirely/api-client';
import {
  type RunFigure,
  type RunTrack,
  formatWallClock,
  runTrack,
  runTracks,
  wallOfZoned,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

/** A schedule item as sc-1404's rules read it: its planned start, and its marks as wall-clock times rather than RFC 3339. */
export type RunItem = ScheduleItem & { planned: string };

export interface RunTrackView {
  key: string;
  name: string;
  track: RunTrack<RunItem>;
}

export function runItemOf(one: ScheduleItem): RunItem {
  return {
    ...one,
    planned: wallOfZoned(one.startsAt),
    startedAt: one.startedAt == null ? null : wallOfZoned(one.startedAt),
    endedAt: one.endedAt == null ? null : wallOfZoned(one.endedAt),
  };
}

/** One table per place on each event day; the day is named only when the schedule spans more than one. */
export function runViews(
  items: readonly ScheduleItem[],
  now: string,
  main: string,
  dayName: (day: string) => string,
  t: TFunction,
): RunTrackView[] {
  const tracks = runTracks(items.map(runItemOf));
  const days = new Set(tracks.map((track) => track.day));

  return tracks.map((track) => {
    const place = track.place ?? main;

    return {
      key: `${track.day}|${track.place ?? ''}`,
      name: days.size > 1 ? t('runView.trackOnDay', { place, day: dayName(track.day) }) : place,
      track: runTrack(track.items, now),
    };
  });
}

export function clock(wall: string, locale: string): string {
  return formatWallClock(wall, locale);
}

export function figureWords(figure: RunFigure, t: TFunction): string {
  switch (figure.kind) {
    case 'onTime':
      return t('runView.onTime');
    case 'behind':
      return t('runView.behind', { count: figure.minutes });
    case 'last':
      return t('runView.last');
    case 'done':
      return t('runView.allDone');
  }
}

/** What assistive technology is told when the heading changes: the track's name with it. */
export function figureSaid(name: string, figure: RunFigure, t: TFunction): string {
  switch (figure.kind) {
    case 'onTime':
      return t('runView.saidOnTime', { track: name });
    case 'behind':
      return t('runView.saidBehind', { track: name, count: figure.minutes });
    case 'last':
      return t('runView.saidLast', { track: name });
    case 'done':
      return t('runView.saidDone', { track: name });
  }
}

/** The line that ends each table: what is next and when, or that nothing follows. */
export function nextLine(view: RunTrackView, locale: string, t: TFunction): string {
  const { track } = view;

  if (track.figure.kind === 'done') return t('runView.allDone');
  if (track.next == null) return t('runView.nothingAfter');

  const { item, expected } = track.next;

  return expected === item.planned
    ? t('runView.nextAt', { title: item.title, time: clock(expected, locale) })
    : t('runView.nextAbout', { title: item.title, time: clock(expected, locale) });
}

export function collisionWords(
  before: RunItem,
  fixed: RunItem,
  locale: string,
  t: TFunction,
): string {
  return t('runView.collision', {
    before: before.title,
    fixed: fixed.title,
    time: clock(fixed.planned, locale),
  });
}
