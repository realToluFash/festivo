import type { TFunction } from 'i18next';

/** "2 happening now · 3 upcoming · 1 draft", leaving out any part whose count is 0; null with nothing to count (sc-22103). */
export function summaryWords(
  counts: { happeningNow: number; upcoming: number; drafts: number },
  t: TFunction,
): string | null {
  const parts = [
    counts.happeningNow > 0 &&
      t('eventsScreen.summaryHappeningNow', { count: counts.happeningNow }),
    counts.upcoming > 0 && t('eventsScreen.summaryUpcoming', { count: counts.upcoming }),
    counts.drafts > 0 && t('eventsScreen.summaryDrafts', { count: counts.drafts }),
  ].filter((part): part is string => typeof part === 'string');

  return parts.length === 0
    ? null
    : parts.reduceRight((rest, first) => t('eventsScreen.summaryJoin', { first, rest }));
}
