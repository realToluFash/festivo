import type { ListedEvent } from '@soirely/api-client';
import { serverClock, today } from '@soirely/domain';
import { useEffect, useState } from 'react';

import { api } from './api.ts';
import type { ShownEvent } from './components/today.ts';
import { dateLocale } from './i18n/index.ts';
import { shownEvent } from './routes/app/todayMoment.ts';

/** Today's Your events, in Today's order: under way, still to come, then drafts. */
export function sidebarEvents(
  events: readonly ListedEvent[],
  at: Date,
  now: Date,
  reader: { timeZone: string; locale: string },
): ShownEvent[] {
  return today({ events, at }, now, { ...reader, hour: 0 }).events.map(shownEvent);
}

/**
 * The desk sidebar's Your events in the current organisation, loaded by the sidebar itself so
 * no screen's own loading or filters change it. Each move re-reads it and keeps what it has
 * meanwhile; another organisation's list is never shown, not even while the new one loads.
 */
export function useSidebarEvents(organisationId: string | null, pathname: string): ShownEvent[] {
  const [loaded, setLoaded] = useState<{ organisationId: string; events: ShownEvent[] } | null>(
    null,
  );

  useEffect(() => {
    if (organisationId == null) return;

    let current = true;

    api.allEvents(organisationId).then(
      (events) => {
        if (!current) return;

        const now = serverClock.now();
        const reader = {
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: dateLocale(),
        };

        setLoaded({ organisationId, events: sidebarEvents(events, now, now, reader) });
      },
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [organisationId, pathname]);

  return loaded != null && loaded.organisationId === organisationId ? loaded.events : [];
}
