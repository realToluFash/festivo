import { type OrganisationEvent } from '@soirely/api-client';
import { countsOf, formatWallDay, haventLine, wallDay } from '@soirely/domain';
import { type TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { closesAtClock } from '../../../replyBy.ts';
import { canOn } from '../../../session.ts';

/** Who hasn't replied, as Guests' card counts them; null until read, or for a reader the headcount is not for. */
export interface Havent {
  count: number;
  line: string;
}

export function useHavent(event: OrganisationEvent, wanted = true): Havent | null {
  const { t } = useTranslation();
  const [havent, setHavent] = useState<Havent | null>(null);
  const reads = wanted && canOn(event, 'guests.read');

  useEffect(() => {
    if (!reads) return;
    let current = true;

    api.headcount(event.id).then(
      (headcount) => {
        const counts = countsOf(headcount.counts);
        if (current) setHavent({ count: counts.havent, line: haventLine(t, counts) });
      },
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [event.id, reads, t]);

  return havent;
}

/** l10n, #33572: one toast per Reply by, wherever the save came from; a day already past closed replies at the save. */
export function replyBySaid(
  next: string | null,
  now: Date,
  timeZone: string,
  t: TFunction,
): string {
  const locale = dateLocale();
  if (next == null) return t('eventReplyBy.savedNone');
  if (next < wallDay(now, timeZone)) return t('eventReplyBy.savedClosed');

  return t('eventReplyBy.saved', {
    date: formatWallDay(next, locale),
    time: closesAtClock(locale),
    zone: timeZone,
  });
}
