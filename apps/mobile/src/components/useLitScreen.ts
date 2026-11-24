import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { screenBrightness } from '../../modules/screen-brightness/index.ts';

const TAG = 'soirely.doorCode';

/** While a code is shown it is held up across a room: full brightness and awake, both put back on leaving (pm, 7 Nov). */
export function useLitScreen(shown: boolean): void {
  useEffect(() => {
    if (!shown) return;
    const raise = () => void screenBrightness?.raise().catch(() => undefined);
    raise();
    void activateKeepAwakeAsync(TAG).catch(() => undefined);
    // iOS puts the level back as the app leaves, so it is raised again on return.
    const back = AppState.addEventListener('change', (state) => {
      if (state === 'active') raise();
    });

    return () => {
      back.remove();
      void screenBrightness?.restore().catch(() => undefined);
      void deactivateKeepAwake(TAG).catch(() => undefined);
    };
  }, [shown]);
}
