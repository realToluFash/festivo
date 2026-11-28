import { useEffect, useState } from 'react';

import { ZONE_HELD_MS } from './AccountModel.ts';

/** Seconds until a new code may be sent; an expired code starts with none to wait. */
export function useCountdown(
  seconds: number,
  waiting = true,
): { left: number; restart: () => void } {
  const [left, setLeft] = useState(waiting ? seconds : 0);
  const [round, setRound] = useState(waiting ? 1 : 0);

  useEffect(() => {
    if (round === 0) return undefined;
    const started = Date.now();
    const timer = setInterval(() => {
      const next = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(next);
      if (next === 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds, round]);

  return {
    left,
    restart: () => {
      setLeft(seconds);
      setRound((value) => value + 1);
    },
  };
}

/** True while the sample's zone list is held back, until it arrives ZONE_HELD_MS after the page opens. */
export function useZoneHeld(held: boolean): boolean {
  const [waiting, setWaiting] = useState(held);

  useEffect(() => {
    if (!held) return undefined;
    const timer = setTimeout(() => setWaiting(false), ZONE_HELD_MS);

    return () => clearTimeout(timer);
  }, [held]);

  return waiting;
}
