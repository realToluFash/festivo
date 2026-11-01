import { connection, createOfflineWatch } from '@soirely/domain';
import {
  type RefObject,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
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
  const showing = state.stale && loaded && at != null;

  useLayoutEffect(() => {
    show(showing ? { at, retry: offline.retry, unanswered } : null);
  }, [show, showing, at, offline, unanswered]);

  useLayoutEffect(() => () => show(null), [show]);

  return { watch: offline.watch, refreshing: state.out > 0 && loaded };
}
