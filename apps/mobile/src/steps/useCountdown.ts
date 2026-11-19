import { useCallback, useEffect, useState } from 'react';

/** Seconds left of a wait that starts at once, and starts again on `restart`, for as long as it is given. */
export function useCountdown(seconds: number): {
  left: number;
  restart: (from?: number) => void;
} {
  const [endsAt, setEndsAt] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    if (left === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 250);

    return () => clearInterval(timer);
  }, [left]);

  const restart = useCallback(
    (from = seconds) => {
      const start = Date.now();
      setNow(start);
      setEndsAt(start + from * 1000);
    },
    [seconds],
  );

  return { left, restart };
}
