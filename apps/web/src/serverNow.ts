import { serverClock } from '@soirely/domain';
import { useEffect, useState } from 'react';

const TICK = 15_000;

/** The corrected clock, read again every 15 seconds and at once when the tab comes back (sc-3585). */
export function useServerNow(): Date {
  const [now, setNow] = useState(() => serverClock.now());

  useEffect(() => {
    const tick = () => setNow(serverClock.now());
    const back = () => document.visibilityState === 'visible' && tick();
    const id = window.setInterval(tick, TICK);

    document.addEventListener('visibilitychange', back);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', back);
    };
  }, []);

  return now;
}

/** When this copy of the event arrived, by the corrected clock: its phase is the server's until a boundary passes after it. */
export function useLoadedAt(event: object): Date {
  const [held, setHeld] = useState(() => ({ event, at: serverClock.now() }));

  if (held.event === event) return held.at;

  const next = { event, at: serverClock.now() };
  setHeld(next);

  return next.at;
}
