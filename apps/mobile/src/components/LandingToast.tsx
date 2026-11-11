import { StyleSheet, View } from 'react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { watchMovedOn } from './focusedField.ts';
import { useKeyboardTop } from './keyboardWatch.ts';
import { stepsSoFar, useLandedStep } from './landedStep.ts';
import { landingToastBottom } from './landingToastBottom.ts';
import { SETTLED_MS } from './Screen.tsx';
import { TAB_BAR } from './TodayScreen.tsx';
import { Toast } from './Toast.tsx';

let said: string | null = null;
let saidOver = 0;
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
  // The step it is said from is still in front as the flow moves on, and is not where it lands.
  saidOver = stepsSoFar();
  set(key);
}

/** Over the whole stack; on a phone it clears the tab bar, and on a step the button docked at its foot, to whose column a tablet keeps it. On a step it stays while the field it landed on keeps focus, and closes as another control takes it (sc-37519). */
export function LandingToast() {
  const { t } = useTranslation();
  const key = useSyncExternalStore(subscribe, () => said);
  const insets = useSafeAreaInsets();
  // The frame the toast is laid out in, which the keys' top is read against: Android's window height leaves out the system bars, and measured from it the toast sat a bar lower, over Continue (sc-29071).
  const [height, setHeight] = useState<number | null>(null);
  const keyboardTop = useKeyboardTop();
  const { kind } = useLayout();
  const step = useLandedStep(saidOver);
  const stepId = step?.id;
  const column = kind === 'phone' ? null : step?.column;

  useEffect(() => {
    if (key == null || stepId == null) return undefined;
    const watch = watchMovedOn(() => set(null));
    // Focus the step lands with is not focus moving: the field it settles on is the one typed in.
    const settled = setTimeout(watch.settled, SETTLED_MS);

    return () => {
      clearTimeout(settled);
      watch.stop();
    };
  }, [key, stepId]);

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
            column == null ? styles.margins : { left: column.x, width: column.width },
            // On a step it rides above the foot, docked on the keys or at the screen's foot.
            {
              bottom: landingToastBottom(
                insets.bottom,
                kind === 'phone' ? TAB_BAR : 0,
                height,
                keyboardTop,
                step != null,
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
  toast: { position: 'absolute' },
  margins: { left: tokens.spaceXl, right: tokens.spaceXl },
});
