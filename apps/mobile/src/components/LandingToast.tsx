import { StyleSheet, View } from 'react-native';
import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { useKeyboardTop } from './keyboardWatch.ts';
import { landingToastBottom } from './landingToastBottom.ts';
import { TAB_BAR } from './TodayScreen.tsx';
import { Toast } from './Toast.tsx';

let said: string | null = null;
const listeners = new Set<() => void>();

function set(words: string | null): void {
  said = words;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** Said over whichever screen a flow lands on, which the flow cannot know in advance: Home, or a step still owed. A key, so the words are in the language the account brings with it, which may arrive after the call (sc-29071). */
export function sayOnLanding(key: string): void {
  set(key);
}

/** Over the whole stack; on a phone it clears the tab bar, and on a step the button docked at its foot. */
export function LandingToast() {
  const { t } = useTranslation();
  const key = useSyncExternalStore(subscribe, () => said);
  const insets = useSafeAreaInsets();
  // The frame the toast is laid out in, which the keys' top is read against: Android's window height leaves out the system bars, and measured from it the toast sat a bar lower, over Continue (sc-29071).
  const [height, setHeight] = useState<number | null>(null);
  const keyboardTop = useKeyboardTop();
  const { kind } = useLayout();

  if (key == null) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      {height != null && (
        <View
          style={[
            styles.toast,
            // A step that lands with its field focused raises the keys, so the toast rides above the foot docked on them.
            {
              bottom: landingToastBottom(
                insets.bottom,
                kind === 'phone' ? TAB_BAR : 0,
                height,
                keyboardTop,
              ),
            },
          ]}
          pointerEvents="box-none"
        >
          <Toast key={key} words={t(key)} onClose={() => set(null)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
