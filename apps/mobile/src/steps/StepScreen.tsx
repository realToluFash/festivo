import { useTranslation } from 'react-i18next';
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { QuietButton } from '../components/Buttons.tsx';
import { keyboardTopNow, useKeysUp, watchKeyboardTop } from '../components/keyboardWatch.ts';
import { stepShown } from '../components/landedScreen.ts';
import { moveScreenReaderFocus } from '../components/screenReaderFocus.ts';
import {
  ScreenScroll,
  SETTLED_MS,
  useFocusedFieldAboveToast,
  useScreenScrollView,
  useWindowOrigin,
} from '../components/Screen.tsx';
import { barFits, keysOver } from '../kit/keyboard.ts';
import { useLayout } from '../layout/useLayout.ts';
import { glide } from '../motion.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { stepFill } from '../kit/stepFill.ts';

/** Inside the iPad's sheet, which UIKit lifts away from the keys itself and which has no safe area of its own. */
export const InSheet = createContext(false);

export function useInSheet(): boolean {
  return useContext(InSheet);
}

/** On iPad the steps come up as a sheet; on a phone they fill the screen. */
export function useStepsInSheet(): boolean {
  const { kind } = useLayout();

  return Platform.OS === 'ios' && kind !== 'phone';
}

export type NavLeft = 'back' | 'close' | { label: string; onPress: () => void } | null;

export function NavBar({
  left = 'back',
  onLeft,
  step,
  right,
  testID = 'steps',
}: {
  left?: NavLeft;
  onLeft: () => void;
  /** Which step of how many; a half step is a step just done, its bar part way to the next. */
  step?: readonly [number, number];
  right?: { label: string; onPress: () => void };
  testID?: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.bar}>
      {left === 'back' || left === 'close' ? (
        <Pressable
          style={styles.icon}
          onPress={onLeft}
          accessibilityRole="button"
          accessibilityLabel={left === 'back' ? t('steps.back') : t('steps.close')}
          hitSlop={tokens.spaceXxs}
          testID={`${testID}.${left}`}
        >
          <Svg
            width={tokens.space3xl}
            height={tokens.space3xl}
            viewBox="0 0 24 24"
            fill="none"
            stroke={tokens.colorInk}
            strokeWidth={2.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={left === 'close' ? CLOSE : ANDROID ? BACK_ANDROID : BACK_IOS} />
          </Svg>
        </Pressable>
      ) : left != null ? (
        <QuietButton label={left.label} onPress={left.onPress} testID={`${testID}.left`} />
      ) : (
        <View style={styles.spare} />
      )}
      {step != null ? <StepBar step={step[0]} steps={step[1]} /> : <View style={styles.grow} />}
      {right != null ? (
        <QuietButton label={right.label} onPress={right.onPress} testID={`${testID}.right`} />
      ) : (
        <View style={styles.spare} />
      )}
    </View>
  );
}

const ANDROID = Platform.OS === 'android';

const BACK_IOS = 'M15 4.5 7.5 12l7.5 7.5';
const BACK_ANDROID = 'M20 12H4.5M11 5.5 4.5 12l6.5 6.5';
const CLOSE = 'M6 6l12 12M18 6 6 18';

/** Fills from the step before to this one as the screen comes in; a screen reader hears "Step 2 of 4". */
export function StepBar({ step, steps }: { step: number; steps: number }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const whole = Math.ceil(step);
  const [fill] = useState(() => new Animated.Value(stepFill(Math.max(0, step - 1), steps)));
  const first = useRef(true);

  useEffect(() => {
    const to = stepFill(step, steps);
    if (reduced) {
      fill.setValue(to);
      return;
    }
    const run = glide(fill, to, first.current ? tokens.motionSlow : tokens.motionBase);
    first.current = false;
    run.start();

    return () => run.stop();
  }, [fill, reduced, step, steps]);

  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('steps.stepOf', { step: Math.min(whole, steps), steps })}
      accessibilityValue={{ min: 0, max: steps, now: Math.min(whole, steps) }}
    >
      <Animated.View style={[styles.fill, { transform: [{ scaleX: fill }] }]} />
    </View>
  );
}

/** Where UIKit pins a sheet too tall to clear the keys, under the status bar: 14pt on iPadOS 26, taken a little lower so the foot never runs under. */
const SHEET_LIFTED_GAP = tokens.spaceXl;

/** What the keys still cover, measured as Screen does: Android's avoiding view never hears of keys already up as a screen opens, and UIKit lifts an iPad's sheet only to the top, where a tall one still runs under them. */
function useKeysCover(
  page: RefObject<ViewInstance | null>,
  on: boolean,
  /** Where the page starts on screen beyond what it measures: inside a sheet it measures from the sheet's own top. */
  offset: number,
): number {
  const origin = useWindowOrigin();
  const top = useRef<number | null>(null);
  const [cover, setCover] = useState(0);
  const measure = useCallback(() => {
    const keys = top.current;
    if (keys == null) {
      setCover(0);
      return;
    }
    page.current?.measureInWindow((_x, y, _w, height) => {
      setCover(keysOver({ y: y + offset, height }, keys));
    });
  }, [page, offset]);

  useEffect(() => {
    if (!on) return undefined;
    top.current = keyboardTopNow(origin);
    measure();
    // Measured mid-transition, the page can still be sliding in.
    const settled = setTimeout(measure, SETTLED_MS);
    const unwatch = watchKeyboardTop(
      () => origin,
      (next) => {
        top.current = next;
        measure();
      },
    );

    return () => {
      clearTimeout(settled);
      unwatch();
    };
  }, [on, origin, measure]);

  return cover;
}

export function StepScreen({
  nav,
  children,
  foot,
  centred = false,
}: {
  nav?: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
  /** Content in the middle of the screen, as welcome and the endings with no bar are. */
  centred?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const inSheet = useInSheet();
  const keysUp = useKeysUp();
  const { width } = useWindowDimensions();
  const side = inSheet ? tokens.space5xl : width < 380 ? tokens.spaceXl : tokens.space3xl;
  const top = inSheet ? tokens.spaceLg : insets.top;
  const bottom = keysUp || inSheet ? tokens.spaceXl : Math.max(insets.bottom, tokens.spaceLg);
  const page = useRef<ViewInstance>(null);
  const measured = ANDROID || inSheet;
  const cover = useKeysCover(page, measured, inSheet ? insets.top + SHEET_LIFTED_GAP : 0);
  const { screenScroll, scrollProps } = useScreenScrollView();
  useFocusedFieldAboveToast(screenScroll);
  const [sizes, setSizes] = useState({ shown: 0, foot: 0, field: 0, group: 0 });
  const measuredAs = (key: 'shown' | 'foot') => (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setSizes((was) => (was[key] === height ? was : { ...was, [key]: height }));
  };
  const [inline, setInline] = useState(false);
  // While docked the scroll view ends at the foot, while in place at the keys.
  const room = sizes.shown + (inline ? 0 : sizes.foot);
  const nextInline =
    foot != null &&
    keysUp &&
    sizes.field > 0 &&
    !barFits({
      room,
      field: Math.max(sizes.field, sizes.group),
      bar: sizes.foot,
      margin: tokens.spaceLg,
    });
  if (nextInline !== inline) setInline(nextInline);
  const footRef = useRef<ViewInstance>(null);
  const wasInline = useRef(inline);
  const hasFoot = foot != null;
  const shown = useRef<ReturnType<typeof stepShown> | null>(null);
  const footInPage = useRef(inline);

  // Measured as it slides in, the foot would be placed where it is passing: it is placed only once it has landed.
  const placeFoot = useCallback(() => {
    if (shown.current == null) return;
    if (footRef.current == null) shown.current.placed(null);
    else
      footRef.current.measureInWindow((x, y, width) =>
        shown.current?.placed({ x, width, top: footInPage.current ? null : y }),
      );
  }, []);

  useEffect(() => {
    const step = stepShown();
    const landed = setTimeout(() => {
      shown.current = step;
      placeFoot();
    }, SETTLED_MS);

    return () => {
      clearTimeout(landed);
      shown.current = null;
      step.left();
    };
  }, [placeFoot]);

  useEffect(() => {
    footInPage.current = inline;
    placeFoot();
  }, [inline, hasFoot, placeFoot]);

  // The keys move the foot without laying it out again where the page pads for them, or a sheet rises clear of them.
  useEffect(() => {
    if (!hasFoot) return undefined;
    let settled: ReturnType<typeof setTimeout> | undefined;
    const unwatch = watchKeyboardTop(
      () => 0,
      () => {
        placeFoot();
        clearTimeout(settled);
        settled = setTimeout(placeFoot, SETTLED_MS);
      },
    );

    return () => {
      clearTimeout(settled);
      unwatch();
    };
  }, [hasFoot, placeFoot]);

  useEffect(() => {
    if (!keysUp) return;
    TextInput.State.currentlyFocusedInput()?.measure((_x, _y, _w, height) => {
      setSizes((was) => (was.field === height ? was : { ...was, field: height }));
    });

    return () => {
      setSizes((was) => (was.group === 0 ? was : { ...was, group: 0 }));
    };
  }, [keysUp]);

  // The field's own lines, a rule or an error under it, have to fit above a docked foot too, kept apart from the input height so whichever lands last cannot undo the other.
  useEffect(() => {
    const needs = (height: number) =>
      setSizes((was) => (was.group === height ? was : { ...was, group: height }));
    screenScroll.focusedGroup.add(needs);

    return () => {
      screenScroll.focusedGroup.delete(needs);
    };
  }, [screenScroll]);

  // The foot remounts as it moves, and a press on it that sent the keys down would leave the screen reader on nothing.
  useEffect(() => {
    const docking = wasInline.current && !inline;
    const undocking = !wasInline.current && inline;
    wasInline.current = inline;
    // A lift the keys asked for while the bar rested on them was for less room than the scroll now has.
    if (undocking) screenScroll.settle();
    if (!docking) return;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (on) moveScreenReaderFocus(footRef.current);
    });
  }, [inline, screenScroll]);

  const footView = (
    <View
      style={[
        styles.edge,
        styles.foot,
        inline ? styles.inlineFoot : { paddingHorizontal: side, paddingBottom: bottom },
      ]}
      onLayout={(event) => {
        if (!inline) measuredAs('foot')(event);
        placeFoot();
      }}
    >
      <View ref={footRef} style={[styles.column, styles.footColumn]} onLayout={placeFoot}>
        {foot}
      </View>
    </View>
  );

  return (
    <View
      ref={page}
      style={[styles.page, { paddingTop: top }, measured && { paddingBottom: cover }]}
    >
      <KeyboardAvoidingView style={styles.grow} behavior="padding" enabled={!measured}>
        {nav != null && (
          <View style={[styles.edge, { paddingHorizontal: side }]}>
            <View style={styles.column}>{nav}</View>
          </View>
        )}
        <ScrollView
          {...scrollProps}
          onLayout={(event) => {
            scrollProps.onLayout();
            measuredAs('shown')(event);
          }}
          style={styles.grow}
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: side },
            centred && styles.centred,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <ScreenScroll.Provider value={screenScroll}>
            <View style={styles.column}>{children}</View>
            {inline && footView}
          </ScreenScroll.Provider>
        </ScrollView>
        {foot != null && !inline && footView}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  grow: { flex: 1 },
  edge: { alignItems: 'center' },
  column: { width: '100%', maxWidth: 480 },
  footColumn: { gap: tokens.spaceXs },
  content: { flexGrow: 1, alignItems: 'center', paddingBottom: tokens.spaceXl },
  centred: { justifyContent: 'center' },
  foot: { paddingTop: tokens.spaceLg },
  inlineFoot: { width: '100%' },
  bar: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  icon: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    marginLeft: -tokens.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spare: { width: tokens.space5xl },
  track: {
    flex: 1,
    height: tokens.spaceXxs,
    marginHorizontal: tokens.spaceLg,
    borderRadius: tokens.spaceHair,
    backgroundColor: tokens.colorTrack,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
    borderRadius: tokens.spaceHair,
    backgroundColor: tokens.colorAccentHover,
    transformOrigin: 'left',
  },
});
