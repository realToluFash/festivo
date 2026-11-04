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
  Animated,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { QuietButton } from '../components/Buttons.tsx';
import { keyboardTopNow, useKeysUp, watchKeyboardTop } from '../components/keyboardWatch.ts';
import { SETTLED_MS, useWindowOrigin } from '../components/Screen.tsx';
import { keysOver, offsetIntoView } from '../kit/keyboard.ts';
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

const KeepInView = createContext<((group: ViewInstance | null) => void) | null>(null);

/** A field and the lines under it: while its field has focus, the whole group stays in sight above the keys. */
export function StepGroup({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const keep = useContext(KeepInView);
  const group = useRef<ViewInstance>(null);

  return (
    <View
      ref={group}
      style={style}
      onFocus={() => keep?.(group.current)}
      onBlur={() => keep?.(null)}
    >
      {children}
    </View>
  );
}

/** Scrolls the focused StepGroup wholly into sight, now and each time the scroll view resizes, as it does when the keys rise. */
function useKeptGroup() {
  const scroll = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const shown = useRef(0);
  const group = useRef<ViewInstance | null>(null);

  const bring = useCallback(() => {
    const content = scroll.current?.getInnerViewRef();
    if (content == null || group.current == null) return;
    group.current.measureLayout(content, (_x, contentY, _w, height) => {
      const to = offsetIntoView({
        contentY,
        height,
        offset: offset.current,
        shown: shown.current,
        margin: tokens.spaceLg,
      });
      if (to != null) scroll.current?.scrollTo({ y: to, animated: true });
    });
  }, []);

  const keep = useCallback(
    (next: ViewInstance | null) => {
      group.current = next;
      bring();
    },
    [bring],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      shown.current = event.nativeEvent.layout.height;
      bring();
    },
    [bring],
  );
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  }, []);

  return { scroll, onLayout, onScroll, keep };
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
  const { scroll, onLayout, onScroll, keep } = useKeptGroup();

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
          ref={scroll}
          onLayout={onLayout}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={styles.grow}
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: side },
            centred && styles.centred,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.column}>
            <KeepInView.Provider value={keep}>{children}</KeepInView.Provider>
          </View>
        </ScrollView>
        {foot != null && (
          <View
            style={[styles.edge, styles.foot, { paddingHorizontal: side, paddingBottom: bottom }]}
          >
            <View style={[styles.column, styles.footColumn]}>{foot}</View>
          </View>
        )}
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
