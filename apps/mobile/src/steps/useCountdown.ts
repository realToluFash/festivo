import { useCallback, useEffect, useState } from 'react';

/** Seconds left of a wait that starts at once, and starts again on `restart`. */
export function useCountdown(seconds: number): { left: number; restart: () => void } {
  const [endsAt, setEndsAt] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    if (left === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 250);

    return () => clearInterval(timer);
  }, [left]);

  const restart = useCallback(() => {
    const start = Date.now();
    setNow(start);
    setEndsAt(start + seconds * 1000);
  }, [seconds]);

  return { left, restart };
}

/** Seconds until a new code can be sent, as the server last said, counting down. */
export function useCooldown(): [number, (seconds: number) => void] {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [cooldown]);

  return [cooldown, setCooldown];
}
