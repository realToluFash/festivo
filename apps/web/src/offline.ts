import { ApiUnreachableError } from '@soirely/api-client';
import { answeredWithin, connection } from '@soirely/domain';
import {
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

export interface Stale {
  at: Date;
  retry: () => void;
  /** Counts the presses of Try again that came back unanswered, each one announced again. */
  unanswered: number;
}

export const StaleScreen = createContext<{
  stale: Stale | null;
  show: (stale: Stale | null) => void;
}>({ stale: null, show: () => {} });

/** Whether a failed load keeps what the screen already shows: only when Soirely never answered (sc-22586). */
export function keepsWhatLoaded(error: unknown): boolean {
  return error instanceof ApiUnreachableError;
}

/** Every load of the screen goes through `watch`, or the band never learns that Soirely answered again. */
export function useOffline({
  loaded,
  reload,
  title,
}: {
  loaded: boolean;
  reload: () => void;
  title: RefObject<HTMLElement | null>;
}): { watch: <T>(load: Promise<T>) => Promise<T>; refreshing: boolean } {
  const { show } = useContext(StaleScreen);
  const [stale, setStale] = useState(false);
  const [at, setAt] = useState<Date | null>(null);
  const [out, setOut] = useState(0);
  const [unanswered, setUnanswered] = useState(0);
  const pressed = useRef(false);
  const outNow = useRef(0);
  const askedWhileOut = useRef(false);
  const live = useRef({ loaded, reload, stale });

  useLayoutEffect(() => {
    live.current = { loaded, reload, stale };
  });

  // A press while a load is out joins it: no second load, and the 20 s keep counting from the first.
  const retry = useCallback(() => {
    pressed.current = true;
    if (outNow.current === 0) live.current.reload();
  }, []);

  const watch = useCallback(
    <T>(load: Promise<T>): Promise<T> => {
      outNow.current += 1;
      setOut((n) => n + 1);
      const asked = live.current.loaded
        ? answeredWithin(load, () => new ApiUnreachableError())
        : load;

      return asked.then(
        (value) => {
          outNow.current -= 1;
          setOut((n) => n - 1);
          askedWhileOut.current = false;
          setAt(new Date());
          setStale(false);

          if (pressed.current) {
            pressed.current = false;
            requestAnimationFrame(() => title.current?.focus());
          }

          return value;
        },
        (error: unknown) => {
          outNow.current -= 1;
          setOut((n) => n - 1);

          if (!keepsWhatLoaded(error)) setStale(false);
          else if (pressed.current) {
            pressed.current = false;
            setUnanswered((n) => n + 1);
          }

          if (askedWhileOut.current && keepsWhatLoaded(error))
            setTimeout(() => live.current.reload(), 0);

          askedWhileOut.current = false;

          throw error;
        },
      );
    },
    [title],
  );

  useEffect(() => {
    const askAgain = () => {
      if (!live.current.stale) return;

      if (outNow.current === 0) live.current.reload();
      else askedWhileOut.current = true;
    };
    const stop = connection.subscribe((change) => {
      if (change !== 'lost') askAgain();
      else if (live.current.loaded) setStale(true);
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') askAgain();
    };

    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const showing = stale && loaded && at != null;

  useLayoutEffect(() => {
    show(showing ? { at, retry, unanswered } : null);
  }, [show, showing, at, retry, unanswered]);

  useLayoutEffect(() => () => show(null), [show]);

  return { watch, refreshing: out > 0 && loaded };
}
