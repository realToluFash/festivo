import type { ScheduleItem } from '@soirely/api-client';
import { type RunTrackShown, type RunWords, runItemOf, runShown } from '@soirely/domain';
import type { TFunction } from 'i18next';

export type RunItem = ScheduleItem & { planned: string };

export type RunTrackView = RunTrackShown<RunItem>;

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
