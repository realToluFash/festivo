import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { watchMovedOn } from './focusedField.ts';
import { useKeyboardTop } from './keyboardWatch.ts';
import { stepsSoFar, useLandedStep } from './landedStep.ts';
import { type Frame, landingToastBottom, stepsAside, underToast } from './landingToastBottom.ts';
import { landingToastAt, useFieldUnderToast } from './landingToastTop.ts';
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

/** Over the whole stack; on a phone it clears the tab bar, and on a step it rests on the foot as measured, to whose column a tablet keeps it. On a step it stays while the field it landed on keeps focus, and closes as another control takes it (sc-37519, sc-37983). Where it and the focused field do not both fit above the keys it steps aside, mounted so its 10 seconds run on and it is not read out again (sc-37983). */
export function LandingToast() {
  const { t } = useTranslation();
  const key = useSyncExternalStore(subscribe, () => said);
  const insets = useSafeAreaInsets();
  // The frame the toast is laid out in, in the window the foot is measured in, which the keys' top is read against too: Android's window height leaves out the system bars, and measured from it the toast sat a bar lower, over Continue (sc-29071).
  const [frame, setFrame] = useState<Frame | null>(null);
  const frameRef = useRef<ViewInstance>(null);
  const toastRef = useRef<ViewInstance>(null);
  const keyboardTop = useKeyboardTop();
  const { kind } = useLayout();
  const step = useLandedStep(saidOver);
  const stepId = step?.id;
  // A step is measured once it has landed; until then nothing says where its foot will rest.
  const landing = step != null && step.foot == null;
  const shown = key != null && frame != null && !landing;
  const column = kind === 'phone' ? null : step?.foot;
  // Where it sits while laid out, aside or not: stepping aside moves nothing, so it cannot undo itself.
  const [placed, setPlaced] = useState<{ over: number; y: number } | null>(null);
  const placedTop = stepId != null && placed?.over === stepId ? placed.y : null;
  const field = useFieldUnderToast();
  const aside = stepsAside(keyboardTop, field, placedTop);
  const top = shown && !aside ? placedTop : null;

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

  useEffect(() => {
    landingToastAt(top);
  }, [top]);

  useEffect(() => () => landingToastAt(null), []);

  if (key == null) return null;

  return (
    <View
      ref={frameRef}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={() =>
        frameRef.current?.measureInWindow((_x, y, _width, height) =>
          setFrame((was) => (was?.y === y && was.height === height ? was : { y, height })),
        )
      }
    >
      {shown && (
        <View
          ref={toastRef}
          style={[
            styles.toast,
            column == null ? styles.margins : { left: column.x, width: column.width },
            aside && styles.aside,
            {
              bottom: landingToastBottom(
                insets.bottom,
                kind === 'phone' ? TAB_BAR : 0,
                frame.height,
                keyboardTop,
                underToast(step, frame),
              ),
            },
          ]}
          pointerEvents={aside ? 'none' : 'box-none'}
          accessibilityElementsHidden={aside}
          importantForAccessibility={aside ? 'no-hide-descendants' : 'auto'}
          onLayout={() => {
            if (stepId == null) return;
            toastRef.current?.measureInWindow((_x, y) =>
              setPlaced((was) => (was?.over === stepId && was.y === y ? was : { over: stepId, y })),
            );
          }}
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
  aside: { opacity: 0 },
});
