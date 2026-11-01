import { connection, createOfflineWatch } from '@soirely/domain';
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

export { keepsWhatLoaded } from '@soirely/domain';

export interface Stale {
  at: Date;
  retry: () => void;
  /** Counts the presses of Try again that came back unanswered, each one announced again. */
  unanswered: number;
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
}): { watch: <T>(load: Promise<T>) => Promise<T>; stale: Stale | null; refreshing: boolean } {
  const [offline] = useState(() => createOfflineWatch({ connection }));
  const state = useSyncExternalStore(offline.subscribe, offline.state);

  useLayoutEffect(() => {
    offline.setScreen({ loaded, reload, pressAnswered: focusTitle });
  });

  useEffect(() => {
    const stop = offline.start();
    const foreground = AppState.addEventListener('change', (now) => {
      if (now === 'active') offline.askAgain();
    });

    return () => {
      stop();
      foreground.remove();
    };
  }, [offline]);

  const { at, unanswered } = state;

  return {
    watch: offline.watch,
    stale: state.stale && loaded && at != null ? { at, retry: offline.retry, unanswered } : null,
    refreshing: state.out > 0 && loaded,
  };
}
