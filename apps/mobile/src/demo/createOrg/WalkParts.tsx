import { type Ref, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Glyph } from '../../components/Glyph.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text, type TextHandle } from '../../components/Text.tsx';
import { glide } from '../../motion.ts';
import { tokens } from '../../theme/tokens.ts';
import { type Fact, STEPS, type Step, WALK } from './CreateWalk.ts';

export const TWICE = 2;

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** Three bars, Violet as far as the step, and "Step n of 3" under them: one element. */
export function Progress({
  step,
  words,
  align,
  duration,
  reduced,
}: {
  step: Step;
  words: string;
  align: 'center' | 'flex-start';
  duration: number;
  reduced: boolean;
}) {
  return (
    <View
      style={[styles.progress, { alignItems: align }]}
      accessible
      accessibilityLabel={words}
      testID="createWalk.progress"
    >
      <View style={styles.bars}>
        {Array.from({ length: STEPS }, (_, index) => (
          <Bar key={index} reached={index < step} duration={duration} reduced={reduced} />
        ))}
      </View>
      <Text size={13} weight="semibold" muted accessible={false} maxFontSizeMultiplier={1}>
        {words}
      </Text>
    </View>
  );
}

export function Bars({
  step,
  duration,
  reduced,
}: {
  step: Step;
  duration: number;
  reduced: boolean;
}) {
  return (
    <View style={styles.bars} {...hidden}>
      {Array.from({ length: STEPS }, (_, index) => (
        <Bar key={index} reached={index < step} duration={duration} reduced={reduced} />
      ))}
    </View>
  );
}

function Bar({
  reached,
  duration,
  reduced,
}: {
  reached: boolean;
  duration: number;
  reduced: boolean;
}) {
  const [fill] = useState(() => new Animated.Value(reached ? 1 : 0));

  useEffect(() => {
    if (reduced) fill.setValue(reached ? 1 : 0);
    else glide(fill, reached ? 1 : 0, duration).start();
  }, [reached, reduced, duration, fill]);

  return (
    <View style={styles.bar}>
      <Animated.View
        style={[styles.barFill, { transform: [{ scaleX: fill }], transformOrigin: 'left' }]}
      />
    </View>
  );
}

/** Cancel and Back in the nav: they keep their size at every text size. */
export function NavAction({
  label,
  back = false,
  onPress,
  testID,
}: {
  label: string;
  back?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={tokens.spaceXxs}
      style={({ pressed }) => [styles.nav, back && styles.navBack, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      {back && <Glyph name="back" size={20} ink={tokens.colorAccentText} weight={2.2} />}
      <Text
        size={17}
        weight={back ? 'semibold' : 'medium'}
        accessible={false}
        maxFontSizeMultiplier={1}
        style={styles.accent}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const SPIN_MS = 800;

function Ring({ reduced }: { reduced: boolean }) {
  const [turn] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) return;
    const spin = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();

    return () => spin.stop();
  }, [reduced, turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const around = 2 * Math.PI * 7;

  return (
    <Animated.View style={{ transform: [{ rotate }] }} {...hidden}>
      <Svg width={16} height={16} viewBox="0 0 16 16">
        <Circle
          cx={8}
          cy={8}
          r={7}
          fill="none"
          stroke={tokens.colorInkOnDark}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${around * 0.75} ${around}`}
          transform="rotate(45 8 8)"
        />
      </Svg>
    </Animated.View>
  );
}

/** B's pill for the walk's foot; busy keeps its place with a ring and its words, and takes no tap. */
export function WalkButton({
  label,
  kind = 'primary',
  busy = false,
  reduced,
  height,
  size,
  full = true,
  onPress,
  ref,
  testID,
}: {
  label: string;
  kind?: 'primary' | 'secondary';
  busy?: boolean;
  reduced: boolean;
  height: number;
  size: number;
  full?: boolean;
  onPress: () => void;
  ref?: Ref<ViewInstance>;
  testID: string;
}) {
  const primary = kind === 'primary';

  return (
    <Pressable
      ref={ref}
      onPress={busy ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        { minHeight: height, borderRadius: height / 2 },
        full ? styles.full : styles.fit,
        pressed && !busy && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      testID={testID}
    >
      {busy && <Ring reduced={reduced} />}
      <Text
        maxFontSizeMultiplier={TWICE}
        size={size}
        weight="semibold"
        accessible={false}
        numberOfLines={2}
        style={primary ? styles.onAccent : styles.ink}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A refusal in the help's place: the alert mark and main's words, said at once and again with each `answer`. */
export function Refusal({ words, size, answer }: { words: string; size: number; answer: unknown }) {
  useReadOut(words, { interrupts: true, answer });

  return (
    <View style={styles.refusal} {...hidden}>
      <View style={styles.refusalMark}>
        <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.2} />
      </View>
      <Text
        maxFontSizeMultiplier={TWICE}
        size={size}
        weight="medium"
        accessible={false}
        style={[styles.broken, { lineHeight: size * 1.4 }]}
      >
        {words}
      </Text>
    </View>
  );
}

export function Question({
  words,
  size,
  ref,
}: {
  words: string;
  size: number;
  ref?: Ref<TextHandle> | undefined;
}) {
  return (
    <Text
      maxFontSizeMultiplier={TWICE}
      ref={ref}
      size={size}
      weight="bold"
      accessibilityRole="header"
      style={{ lineHeight: size * 1.15, letterSpacing: size * -0.02 }}
    >
      {words}
    </Text>
  );
}

/** "From this device": a shape with words, never a colour alone. */
export function Tag() {
  return (
    <View style={styles.tag}>
      <Text maxFontSizeMultiplier={TWICE} size={12.5} weight="semibold" muted accessible={false}>
        {WALK.fromDevice}
      </Text>
    </View>
  );
}

export function FactLine({ fact, tagged = false }: { fact: Fact; tagged?: boolean }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factHead}>
        <Text
          maxFontSizeMultiplier={TWICE}
          size={13}
          weight="medium"
          muted
          accessible={false}
          style={styles.factLabel}
        >
          {fact.label}
        </Text>
        {tagged && fact.key === 'timezone' && <Tag />}
      </View>
      {fact.key === 'timezone' ? (
        <ZoneLine label={fact.value} />
      ) : (
        <Text
          maxFontSizeMultiplier={TWICE}
          size={15}
          weight="semibold"
          muted={fact.none}
          accessible={false}
          style={styles.factValue}
        >
          {fact.value}
        </Text>
      )}
    </View>
  );
}

/** "Lisbon · Europe/Lisbon" wraps only after its " · ": each side is its own Text, which never breaks inside "Europe/Lisbon". */
export function ZoneLine({ label }: { label: string }) {
  const { fontScale } = useWindowDimensions();
  const [city, zone] = label.split(' · ');
  const value = (words: string) => (
    <Text
      maxFontSizeMultiplier={TWICE}
      size={15}
      weight="semibold"
      accessible={false}
      style={styles.factValue}
    >
      {words}
    </Text>
  );

  if (city == null || zone == null) return value(label);

  return (
    <View style={[styles.zone, { columnGap: tokens.spaceXxs * Math.min(fontScale, TWICE) }]}>
      {value(`${city} ·`)}
      {value(zone)}
    </View>
  );
}

/** Watches a value change after mount, for the read-outs that answer a pick. */
export function useChanged<T>(value: T): object | undefined {
  const first = useRef(value);
  const [answer, setAnswer] = useState<object | undefined>(undefined);

  useEffect(() => {
    if (Object.is(first.current, value)) return;
    first.current = value;
    setAnswer({});
  }, [value]);

  return answer;
}

const styles = StyleSheet.create({
  progress: { gap: tokens.spaceXs },
  bars: { flexDirection: 'row', gap: tokens.spaceXxs },
  bar: {
    width: 24,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: tokens.colorBorder,
  },
  barFill: { flex: 1, backgroundColor: tokens.colorAccent },
  nav: {
    minWidth: tokens.sizeHit,
    height: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
  },
  navBack: { gap: tokens.spaceXxs, paddingHorizontal: tokens.spaceXs },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceSm,
  },
  primary: { backgroundColor: tokens.colorAccent },
  secondary: {
    backgroundColor: tokens.colorCard,
    borderWidth: 1.5,
    borderColor: tokens.colorBorder,
  },
  full: { alignSelf: 'stretch', paddingHorizontal: tokens.spaceXxl },
  fit: { paddingHorizontal: tokens.space3xl },
  onAccent: { color: tokens.colorInkOnDark, textAlign: 'center' },
  ink: { color: tokens.colorInk, textAlign: 'center' },
  refusal: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  refusalMark: { paddingTop: 2 },
  broken: { color: tokens.colorBroken },
  tag: {
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: tokens.colorNeutralFill,
  },
  fact: { gap: tokens.spaceHair },
  factHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  factLabel: { lineHeight: 13 * 1.3 },
  factValue: { lineHeight: 15 * 1.3 },
  zone: { flexDirection: 'row', flexWrap: 'wrap' },
});
