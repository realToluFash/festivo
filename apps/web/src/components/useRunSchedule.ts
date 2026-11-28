import type { Schedule } from '@soirely/api-client';
import { type NowShown, serverClock, watchNowReads } from '@soirely/domain';
import { useEffect, useState } from 'react';

import { api } from '../api.ts';
import { runScheduleFor } from './todayRun.ts';

/** A press shows on Today within a minute, as on the app (sc-29875), with room left for the read itself. */
export const RUN_AGAIN_MS = 50_000;

const NOTHING_SHOWN: NowShown<Schedule> = { schedule: null, asOf: null };

/** The running order of the event under way, for a role that reads it: read on opening, every 50 s, and on returning to the tab; with the last landed read's time once Now is past keeping up (sc-62416). */
export function useRunSchedule(
  event: { id: string; permissions: readonly string[] } | null,
): NowShown<Schedule> {
  const id = runScheduleFor(event);
  const [read, setRead] = useState<{ id: string; shown: NowShown<Schedule> } | null>(null);

  useEffect(() => {
    if (id == null) return undefined;

    const watch = watchNowReads({
      read: () => api.schedule(id),
      every: RUN_AGAIN_MS,
      clock: () => serverClock.now(),
      show: (shown) => setRead({ id, shown }),
    });
    const back = () => document.visibilityState === 'visible' && watch.readNow();
    document.addEventListener('visibilitychange', back);

    return () => {
      watch.stop();
      document.removeEventListener('visibilitychange', back);
    };
  }, [id]);

  return read?.id === id ? read.shown : NOTHING_SHOWN;
}
