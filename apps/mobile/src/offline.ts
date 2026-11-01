import { ApiUnreachableError } from '@soirely/api-client';
import { connection } from '@soirely/domain';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export interface Stale {
  at: Date;
  retry: () => void;
  /** Counts the presses of Try again that came back unanswered, each one announced again. */
  unanswered: number;
}

/** Whether a failed load keeps what the screen already shows: only when Soirely never answered (sc-22586). */
export function keepsWhatLoaded(error: unknown): boolean {
  return error instanceof ApiUnreachableError;
}

/** The web's `useOffline`, with the app's foreground in place of the tab's; every load goes through `watch`. */
export function useOffline({
  loaded,
  reload,
  focusTitle,
}: {
  loaded: boolean;
  reload: () => void;
  focusTitle: () => void;
}): { watch: <T>(load: Promise<T>) => Promise<T>; stale: Stale | null } {
  const [stale, setStale] = useState(false);
  const [at, setAt] = useState<Date | null>(null);
  const [out, setOut] = useState(0);
  const [unanswered, setUnanswered] = useState(0);
  const pressed = useRef(false);
  const askedWhileOut = useRef(false);
  const live = useRef({ loaded, reload, focusTitle, out, stale });

  useLayoutEffect(() => {
    live.current = { loaded, reload, focusTitle, out, stale };
  });

  const retry = useCallback(() => {
    pressed.current = true;
    live.current.reload();
  }, []);

  const watch = useCallback(<T>(load: Promise<T>): Promise<T> => {
    setOut((n) => n + 1);

    return load.then(
      (value) => {
        setOut((n) => n - 1);
        askedWhileOut.current = false;
        setAt(new Date());
        setStale(false);

        if (pressed.current) {
          pressed.current = false;
          live.current.focusTitle();
        }

        return value;
      },
      (error: unknown) => {
        setOut((n) => n - 1);

        if (!keepsWhatLoaded(error)) setStale(false);
        else if (pressed.current) {
          pressed.current = false;
          setUnanswered((n) => n + 1);
        }

        if (askedWhileOut.current && keepsWhatLoaded(error)) {
          setTimeout(() => live.current.reload(), 0);
        }

        askedWhileOut.current = false;

        throw error;
      },
    );
  }, []);

  useEffect(() => {
    const askAgain = () => {
      if (!live.current.stale) return;

      if (live.current.out === 0) live.current.reload();
      else askedWhileOut.current = true;
    };
    const stop = connection.subscribe((change) => {
      if (change !== 'lost') askAgain();
      else if (live.current.loaded) setStale(true);
    });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') askAgain();
    });

    return () => {
      stop();
      foreground.remove();
    };
  }, []);

  return {
    watch,
    stale: stale && loaded && at != null ? { at, retry, unanswered } : null,
  };
}
