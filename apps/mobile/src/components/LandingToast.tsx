import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSyncExternalStore } from 'react';
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
  const { height } = useWindowDimensions();
  const keyboardTop = useKeyboardTop();
  const { kind } = useLayout();

  if (key == null) return null;

  // A step that lands with its field focused raises the keys, so the toast rides above the foot docked on them.
  const bottom = landingToastBottom(
    insets.bottom,
    kind === 'phone' ? TAB_BAR : 0,
    height,
    keyboardTop,
  );

  return (
    <View style={[styles.toast, { bottom }]} pointerEvents="box-none">
      <Toast key={key} words={t(key)} onClose={() => set(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
