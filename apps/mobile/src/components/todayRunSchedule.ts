import type { Schedule } from '@soirely/api-client';
import { type NowShown, serverClock, watchNowReads } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';

import { api } from '../api.ts';
import { runScheduleFor } from '../kit/todayRun.ts';

/** Today is a glance: a press shows within a minute, the slow read again sc-3897 settled (pm, 5 Nov), with room left for the read itself. */
export const RUN_AGAIN_MS = 50_000;

const NOTHING_SHOWN: NowShown<Schedule> = { schedule: null, asOf: null };

/** The running order of the event under way, for a role that reads it: read every 50 s and whenever `refresh` changes; with the last landed read's time once Now is past keeping up (sc-62416). */
export function useRunSchedule(
  event: { id: string; permissions: readonly string[] } | null,
  refresh: number,
): NowShown<Schedule> {
  const id = runScheduleFor(event);
  const [read, setRead] = useState<{ id: string; shown: NowShown<Schedule> } | null>(null);
  const watching = useRef<{ id: string; readNow: () => void } | null>(null);
  const [, setMinute] = useState(0);

  useEffect(() => {
    if (id == null) return undefined;

    const watch = watchNowReads({
      read: () =>
        api.schedule(id).catch((error: unknown) => {
          // The clock still moves "until" and the figure on.
          setMinute((n) => n + 1);
          throw error;
        }),
      every: RUN_AGAIN_MS,
      clock: () => serverClock.now(),
      show: (shown) => setRead({ id, shown }),
    });
    watching.current = { id, readNow: watch.readNow };

    return () => {
      watching.current = null;
      watch.stop();
    };
  }, [id]);

  const first = useRef(refresh);

  useEffect(() => {
    if (refresh === first.current) return;
    watching.current?.readNow();
  }, [refresh]);

  return read?.id === id ? read.shown : NOTHING_SHOWN;
}
