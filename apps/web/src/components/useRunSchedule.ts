import type { Schedule } from '@soirely/api-client';
import { useEffect, useState } from 'react';

import { api } from '../api.ts';
import { runScheduleFor } from './todayRun.ts';

/** A press shows on Today within a minute, as on the app (sc-29875), with room left for the read itself. */
export const RUN_AGAIN_MS = 50_000;

/** The running order of the event under way, for a role that reads it: read on opening, every 50 s, and on returning to the tab. */
export function useRunSchedule(
  event: { id: string; permissions: readonly string[] } | null,
): Schedule | null {
  const id = runScheduleFor(event);
  const [read, setRead] = useState<{ id: string; schedule: Schedule } | null>(null);

  useEffect(() => {
    if (id == null) return undefined;

    let live = true;
    // A failed read keeps the last one: the clock still moves "until" and the figure on.
    const readNow = () =>
      api.schedule(id).then(
        (schedule) => live && setRead({ id, schedule }),
        () => undefined,
      );
    const back = () => document.visibilityState === 'visible' && void readNow();

    void readNow();
    const timer = window.setInterval(() => void readNow(), RUN_AGAIN_MS);
    document.addEventListener('visibilitychange', back);

    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', back);
    };
  }, [id]);

  return read?.id === id ? read.schedule : null;
}
