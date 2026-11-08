import { StyleSheet, View } from 'react-native';
import { useSyncExternalStore } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
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

/** Said over whichever screen a flow lands on, which the flow cannot know in advance: Home, or a step still owed. */
export function sayOnLanding(words: string): void {
  set(words);
}

/** Over the whole stack; on a phone it clears the tab bar, and on a step the button docked at its foot. */
export function LandingToast() {
  const words = useSyncExternalStore(subscribe, () => said);
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();

  if (words == null) return null;

  const bottom =
    Math.max(insets.bottom, tokens.spaceLg) + (kind === 'phone' ? TAB_BAR + tokens.spaceLg : 0);

  return (
    <View style={[styles.toast, { bottom }]} pointerEvents="box-none">
      <Toast key={words} words={words} onClose={() => set(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
