import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { bottomOverKeys } from '../kit/keyboard.ts';
import { keyboardTopNow, watchKeyboardTop } from './keyboardWatch.ts';
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

function useKeyboardTop(): number | null {
  const [top, setTop] = useState(() => keyboardTopNow(0));

  useEffect(() => watchKeyboardTop(() => 0, setTop), []);

  return top;
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

  // A step that lands with its field focused raises the keys over the toast, so it rides above them.
  const rest =
    Math.max(insets.bottom, tokens.spaceLg) + (kind === 'phone' ? TAB_BAR + tokens.spaceLg : 0);
  const bottom = bottomOverKeys(rest, height, keyboardTop, tokens.spaceLg);

  return (
    <View style={[styles.toast, { bottom }]} pointerEvents="box-none">
      <Toast key={key} words={t(key)} onClose={() => set(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
