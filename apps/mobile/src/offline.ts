import { connection, createOfflineWatch } from '@soirely/domain';
import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { rereadOrganisations } from './signedIn.ts';

export { keepsWhatLoaded } from '@soirely/domain';

export interface Stale {
  at: Date;
  retry: () => void;
  /** Counts the presses of Try again that came back unanswered, each one announced again. */
  unanswered: number;
}

/** What a screen's load hands up to the frame drawn around it: the band and Refreshing…. */
export interface ScreenOffline {
  stale: Stale | null;
  refreshing: boolean;
}

export const NOT_OFFLINE: ScreenOffline = { stale: null, refreshing: false };

/** The web's `useOffline`, with the app's foreground in place of the tab's; every load goes through `watch`. */
export function useOffline({
  loaded,
  reload,
  focusTitle,
  since = null,
}: {
  loaded: boolean;
  reload: () => void;
  focusTitle: () => void;
  /** The minute of what the screen shows, where a load that answers does not replace it: Edit details. */
  since?: Date | null;
}): {
  watch: <T>(load: Promise<T>) => Promise<T>;
  freshen: () => void;
  stale: Stale | null;
  refreshing: boolean;
} {
  const [offline] = useState(() => createOfflineWatch({ connection }));
  const [retry] = useState(() => () => {
    void rereadOrganisations();
    offline.retry();
  });
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
  const stale = useMemo(
    () =>
      state.stale && loaded && at != null
        ? { at: since ?? at, retry, unanswered }
        : null,
    [state.stale, loaded, at, since, retry, unanswered],
  );

  return {
    watch: offline.watch,
    freshen: offline.freshen,
    stale,
    refreshing: state.out > 0 && loaded,
  };
}

/** Hands a load's band up to the frame drawn around it, and takes it back when the load unmounts under that frame. */
export function useHandOffline(
  onOffline: (offline: ScreenOffline) => void,
  { stale, refreshing }: ScreenOffline,
): void {
  useLayoutEffect(() => {
    onOffline({ stale, refreshing });
  }, [onOffline, stale, refreshing]);

  useLayoutEffect(() => () => onOffline(NOT_OFFLINE), [onOffline]);
}
