import { connection, createOfflineWatch } from '@soirely/domain';
import {
  type RefObject,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

export { keepsWhatLoaded } from '@soirely/domain';

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

/** Every load of the screen goes through `watch`, or the band never learns that Soirely answered again. */
export function useOffline(screen: {
  loaded: boolean;
  reload: () => void;
  title: RefObject<HTMLElement | null>;
}): { watch: <T>(load: Promise<T>) => Promise<T>; refreshing: boolean } {
  const { show } = useContext(StaleScreen);
  const { watch, stale, refreshing } = useStaleWatch(screen);
  const at = stale?.at;
  const unanswered = stale?.unanswered;
  const retry = stale?.retry;

  useLayoutEffect(() => {
    show(at == null || retry == null ? null : { at, retry, unanswered: unanswered ?? 0 });
  }, [show, at, retry, unanswered]);

  useLayoutEffect(() => () => show(null), [show]);

  return { watch, refreshing };
}

/** A load of its own, with its own band: the bell's feed, which ages apart from the page under it (sc-27096). */
export function useStaleWatch({
  loaded,
  reload,
  title,
}: {
  loaded: boolean;
  reload: () => void;
  title: RefObject<HTMLElement | null>;
}): { watch: <T>(load: Promise<T>) => Promise<T>; stale: Stale | null; refreshing: boolean } {
  const [offline] = useState(() => createOfflineWatch({ connection }));
  const state = useSyncExternalStore(offline.subscribe, offline.state);

  useLayoutEffect(() => {
    offline.setScreen({
      loaded,
      reload,
      pressAnswered: () => requestAnimationFrame(() => title.current?.focus()),
    });
  });

  useEffect(() => {
    const stop = offline.start();
    const onVisible = () => {
      if (document.visibilityState === 'visible') offline.askAgain();
    };

    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [offline]);

  const { at, unanswered } = state;
  const stale = useMemo(
    () => (state.stale && loaded && at != null ? { at, retry: offline.retry, unanswered } : null),
    [state.stale, loaded, at, offline, unanswered],
  );

  return { watch: offline.watch, stale, refreshing: state.out > 0 && loaded };
}
