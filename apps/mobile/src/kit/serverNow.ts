import { serverClock } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
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

/** The corrected clock's time, read again when `edges` change and as each one passes: a window that opens on a tap and closes on time cannot wait for a tick (sc-4015). */
export function useServerNowAt(edges: readonly number[]): Date {
  const [now, setNow] = useState(() => serverClock.now());
  const key = edges.join(' ');
  const seen = useRef(key);

  useEffect(() => {
    if (seen.current !== key) {
      seen.current = key;
      setNow(serverClock.now());
    }
    const current = serverClock.now().getTime();
    const next = Math.min(...edges.filter((edge) => edge > current));
    if (!Number.isFinite(next)) return undefined;
    const timer = setTimeout(() => setNow(serverClock.now()), next - current);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `edges`, so a new array with the same edges sets no clock
  }, [key, now]);

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
