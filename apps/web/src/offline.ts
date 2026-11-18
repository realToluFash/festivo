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
  show: (screen: symbol, stale: Stale | null) => void;
  /** A page that says it is offline in its own words keeps the shell's band and box away (sc-3895). */
  hushed: boolean;
  hush: (on: boolean) => void;
}>({ stale: null, show: () => {}, hushed: false, hush: () => {} });

/** For a page whose own notice is the only one: the shell draws none while it is open, and the page reads the stale load here. */
export function useOwnOfflineNotice(): Stale | null {
  const { stale, hush } = useContext(StaleScreen);

  useLayoutEffect(() => {
    hush(true);

    return () => hush(false);
  }, [hush]);

  return stale;
}

/** Every load of the screen goes through `watch`, or the band never learns that Soirely answered again. */
export function useOffline(screen: {
  loaded: boolean;
  reload: () => void;
  title: RefObject<HTMLElement | null>;
  /** The minute of what the screen shows, where a load that answers does not replace it: Edit details. */
  since?: Date | null;
}): {
  watch: <T>(load: Promise<T>) => Promise<T>;
  keep: (at: Date) => void;
  refreshing: boolean;
} {
  const { show } = useContext(StaleScreen);
  const [screenId] = useState(() => Symbol('screen'));
  const { watch, keep, stale, refreshing } = useStaleWatch(screen);
  const at = stale == null ? undefined : (screen.since ?? stale.at);
  const unanswered = stale?.unanswered;
  const retry = stale?.retry;

  useLayoutEffect(() => {
    show(screenId, at == null || retry == null ? null : { at, retry, unanswered: unanswered ?? 0 });
  }, [show, screenId, at, retry, unanswered]);

  useLayoutEffect(() => () => show(screenId, null), [show, screenId]);

  return { watch, keep, refreshing };
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
}): {
  watch: <T>(load: Promise<T>) => Promise<T>;
  keep: (at: Date) => void;
  stale: Stale | null;
  refreshing: boolean;
} {
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

  return { watch: offline.watch, keep: offline.keep, stale, refreshing: state.out > 0 && loaded };
}
