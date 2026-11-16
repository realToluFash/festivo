import type { Schedule } from '@soirely/api-client';
import { roleHolds } from '@soirely/domain';
import { useEffect, useState } from 'react';

import { api } from '../api.ts';

/** Today is a glance: a press shows within a minute, the slow read again sc-3897 settled (pm, 5 Nov), with room left for the read itself. */
export const RUN_AGAIN_MS = 50_000;

/** The running order of the event under way, for a role that reads it; read again every minute and whenever `refresh` changes. */
export function useRunSchedule(
  event: { id: string; permissions: readonly string[] } | null,
  refresh: number,
): Schedule | null {
  const id = event != null && roleHolds(event, 'run_of_show.read') ? event.id : null;
  const [read, setRead] = useState<{ id: string; schedule: Schedule } | null>(null);
  const [, setMinute] = useState(0);

  useEffect(() => {
    if (id == null) return undefined;

    let live = true;
    const readNow = () =>
      api.schedule(id).then(
        (schedule) => live && setRead({ id, schedule }),
        // Kept as last read, and the clock still moves "until" and the figure on.
        () => live && setMinute((n) => n + 1),
      );

    void readNow();
    const timer = setInterval(() => void readNow(), RUN_AGAIN_MS);

    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [id, refresh]);

  return read?.id === id ? read.schedule : null;
}
