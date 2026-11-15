import type { ScheduleItem } from '@soirely/api-client';
import { type RunTrackShown, type RunWords, runShown, wallOfZoned } from '@soirely/domain';
import type { TFunction } from 'i18next';

/** A schedule item as sc-1404's rules read it: its planned start, and its marks as wall-clock times rather than RFC 3339. */
export type RunItem = ScheduleItem & { planned: string };

export type RunTrackView = RunTrackShown<RunItem>;

export function runItemOf(one: ScheduleItem): RunItem {
  return {
    ...one,
    planned: wallOfZoned(one.startsAt),
    startedAt: one.startedAt == null ? null : wallOfZoned(one.startedAt),
    endedAt: one.endedAt == null ? null : wallOfZoned(one.endedAt),
  };
}

export function runViews(
  items: readonly ScheduleItem[],
  now: string,
  main: string,
  dayName: (day: string) => string,
): RunTrackView[] {
  return runShown(items.map(runItemOf), now, main, dayName);
}

export function said(t: TFunction, [key, values]: RunWords): string {
  return values == null ? t(key) : t(key, values);
}
