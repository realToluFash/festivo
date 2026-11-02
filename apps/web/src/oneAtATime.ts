import { useCallback, useRef } from 'react';

/** Wraps a click's request so a second press while it runs sends nothing, without turning its button off. */
export function useOneAtATime(): (request: () => Promise<void>) => Promise<void> {
  const running = useRef(false);

  return useCallback(async (request) => {
    if (running.current) return;

    running.current = true;

    try {
      await request();
    } finally {
      running.current = false;
    }
  }, []);
}
