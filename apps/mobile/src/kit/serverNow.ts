import { type OrganisationEvent } from '@soirely/api-client';
import { serverClock } from '@soirely/domain';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const TICK_MS = 15_000;

/** The corrected clock's time, read again every 15 s and at once when the app comes back to the foreground (sc-3585). */
export function useServerNow(): Date {
  const [now, setNow] = useState(() => serverClock.now());

  useEffect(() => {
    const tick = () => setNow(serverClock.now());
    const timer = setInterval(tick, TICK_MS);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);

  return now;
}

/** When this copy of the event arrived, by the corrected clock: its phase is the server's until a boundary passes after it. */
export function useLoadedAt(event: OrganisationEvent): Date {
  const [held, setHeld] = useState(() => ({ event, at: serverClock.now() }));

  if (held.event === event) return held.at;

  const next = { event, at: serverClock.now() };
  setHeld(next);

  return next.at;
}
