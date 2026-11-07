import type { CalendarShow, CalendarView } from '@soirely/domain';
import { type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { motionEase } from '../../motion.ts';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { type Anchor, AnchoredMenu } from '../settings/Summary.tsx';
import { CW, say } from './CalendarWords.ts';

/** The toolbar's words grow to twice their size and no further, so Month, Show and the month's name are never cut. */
const DOUBLED = 2;

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

const VIEWS: readonly [CalendarView, string][] = [
  ['month', CW.month],
  ['agenda', CW.agenda],
];

/** View, main's radiogroup, in B's segment: the chosen half white with a tick. */
export function ViewSwitch({
  view,
  onView,
  big,
}: {
  view: CalendarView;
  onView: (view: CalendarView) => void;
  big: boolean;
}) {
  return (
    <View style={[styles.segment, big && styles.segmentBig]} accessibilityRole="radiogroup">
      {VIEWS.map(([each, word]) => {
        const on = each === view;

        return (
          <Pressable
            key={each}
            onPress={() => onView(each)}
            style={[styles.cell, big && styles.cellBig, on && styles.cellOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={word}
            testID={`calendar.view.${each}`}
          >
            {on && <Glyph name="tick" size={14} ink={tokens.colorAccent} weight={2.6} />}
            <Text
              size={14.5}
              weight={on ? 'semibold' : 'medium'}
              numberOfLines={1}
              maxFontSizeMultiplier={DOUBLED}
              accessible={false}
              style={{ color: on ? tokens.colorAccentText : tokens.colorInkSecondary }}
            >
              {word}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Show, a 44 pill in Surf that reads "Events only" in Tint while that is on. */
export function ShowButton({
  show,
  big,
  onPress,
  ref,
}: {
  show: CalendarShow;
  big: boolean;
  onPress: () => void;
  ref: Ref<ViewInstance>;
}) {
  const only = show === 'events';
  const ink = only ? tokens.colorAccentText : tokens.colorInk;

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        styles.showPill,
        big && styles.pillBig,
        only && styles.pillOn,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={say.choiceIn(CW.show, only ? CW.showEvents : CW.showAll)}
      testID="calendar.show"
    >
      <Glyph name="filter" size={17} ink={ink} weight={2.2} />
      <Text
        size={15}
        weight="semibold"
        numberOfLines={1}
        maxFontSizeMultiplier={DOUBLED}
        accessible={false}
        style={{ color: ink }}
      >
        {only ? CW.showEvents : CW.show}
      </Text>
    </Pressable>
  );
}

/** Show's two choices, under the button with its right edge on Show's. */
export function ShowMenu({
  at,
  show,
  opener,
  onShow,
  onClose,
}: {
  at: Anchor | null;
  show: CalendarShow;
  opener: RefObject<ViewInstance | null>;
  onShow: (show: CalendarShow) => void;
  onClose: () => void;
}) {
  const choices: readonly [CalendarShow, string][] = [
    ['all', CW.showAll],
    ['events', CW.showEvents],
  ];

  return (
    <AnchoredMenu
      at={at == null ? null : { ...at, y: at.y + tokens.spaceXxs }}
      onClose={onClose}
      opener={opener}
      width={264}
      testID="calendar.showMenu"
    >
      <View style={styles.menu}>
        {choices.map(([each, word]) => {
          const on = each === show;

          return (
            <Pressable
              key={each}
              onPress={() => {
                onShow(each);
                onClose();
              }}
              style={({ pressed }) => [
                styles.choice,
                on && styles.choiceOn,
                pressed && !on && styles.choicePressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={word}
              testID={`calendar.show.${each}`}
            >
              <Text
                size={16}
                weight={on ? 'semibold' : 'medium'}
                accessible={false}
                style={[styles.grow, on && styles.accent]}
              >
                {word}
              </Text>
              <View style={styles.tick}>
                {on && <Glyph name="tick" size={18} ink={tokens.colorAccent} weight={2.6} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </AnchoredMenu>
  );
}

function RoundStep({
  glyph,
  label,
  onPress,
  testID,
}: {
  glyph: GlyphName;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Glyph name={glyph} size={18} ink={tokens.colorInk} weight={2.4} />
    </Pressable>
  );
}

/** Previous, Today and Next, 6 apart; Today is Tint while its scroll runs. */
export function Stepper({
  running,
  onStep,
  onToday,
}: {
  running: boolean;
  onStep: (step: -1 | 1) => void;
  onToday: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <RoundStep
        glyph="back"
        label={CW.previous}
        onPress={() => onStep(-1)}
        testID="calendar.previous"
      />
      <Pressable
        onPress={onToday}
        style={({ pressed }) => [styles.pill, running && styles.pillOn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={CW.today}
        testID="calendar.today"
      >
        <Text
          size={15}
          weight="semibold"
          maxFontSizeMultiplier={DOUBLED}
          accessible={false}
          style={{ color: running ? tokens.colorAccentText : tokens.colorInk }}
        >
          {CW.today}
        </Text>
      </Pressable>
      <RoundStep glyph="chevron" label={CW.next} onPress={() => onStep(1)} testID="calendar.next" />
    </View>
  );
}

/** The pinned month's name, a heading said once as it turns, cross-fading in motionFast. */
export function MonthName({ name, size }: { name: string; size: number }) {
  const reduced = useReducedMotion();
  const [was, setWas] = useState<string | null>(null);
  const [shown, setShown] = useState(name);
  const [fade] = useState(() => new Animated.Value(1));

  useReadOut(name, { quietAtMount: true });

  if (name !== shown) {
    setWas(reduced ? null : shown);
    setShown(name);
  }

  useEffect(() => {
    if (was == null) return;
    fade.setValue(0);
    const run = Animated.timing(fade, {
      toValue: 1,
      duration: tokens.motionFast,
      easing: motionEase,
      useNativeDriver: true,
    });
    run.start(({ finished }) => finished && setWas(null));

    return () => run.stop();
  }, [was, fade]);

  const look = [styles.month, { lineHeight: Math.round(size * 1.2), letterSpacing: size * -0.015 }];

  return (
    <View style={styles.monthBox}>
      <Animated.View style={{ opacity: was == null ? 1 : fade }}>
        <Text
          size={size}
          weight="bold"
          numberOfLines={1}
          maxFontSizeMultiplier={DOUBLED}
          accessibilityRole="header"
          style={look}
          testID="calendar.month"
        >
          {shown}
        </Text>
      </Animated.View>
      {was != null && (
        <Animated.View
          {...hidden}
          style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, fade) }]}
        >
          <Text
            size={size}
            weight="bold"
            numberOfLines={1}
            maxFontSizeMultiplier={DOUBLED}
            style={look}
          >
            {was}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

/** Subscribe in your calendar app: a 44 round button in Surf on the phone. */
export function SubscribeRound({ onPress, ref }: { onPress: () => void; ref: Ref<ViewInstance> }) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={CW.subscribe}
      testID="calendar.subscribe"
    >
      <Glyph name="calendar" size={20} ink={tokens.colorInk} weight={2.1} />
    </Pressable>
  );
}

const SPIN_MS = 800;

/** A 16 ring with a Violet arc, turning once every 800 ms; still under Reduce Motion, where its words carry it. */
export function Spinner() {
  const reduced = useReducedMotion();
  const [turn] = useState(() => new Animated.Value(0));
  const loop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (reduced) return;
    loop.current = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.current.start();

    return () => loop.current?.stop();
  }, [reduced, turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View {...hidden} style={[styles.spinner, { transform: [{ rotate }] }]}>
      <Svg width={16} height={16} viewBox="0 0 16 16">
        <Circle cx={8} cy={8} r={6.75} fill="none" stroke={tokens.colorBorder} strokeWidth={2.5} />
        <Path
          d="M8 1.25a6.75 6.75 0 0 1 6.75 6.75"
          fill="none"
          stroke={tokens.colorAccent}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  segment: {
    height: tokens.sizeHit,
    flexDirection: 'row',
    gap: tokens.spaceHair,
    padding: 3,
    borderRadius: tokens.sizeHit / 2,
    backgroundColor: tokens.colorInsetBorder,
  },
  segmentBig: { height: 60, borderRadius: 30, alignSelf: 'stretch' },
  cell: {
    height: 38,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 19,
  },
  cellBig: { flex: 1, height: 54, borderRadius: 27 },
  cellOn: {
    backgroundColor: tokens.colorCard,
    shadowColor: tokens.colorInk,
    shadowOpacity: 0.12,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  pill: {
    height: tokens.sizeHit,
    paddingHorizontal: tokens.spaceXl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: tokens.sizeHit / 2,
    backgroundColor: tokens.colorInset,
  },
  showPill: { paddingLeft: tokens.spacePillEnd },
  pillBig: { minHeight: 60, height: undefined, borderRadius: 30, alignSelf: 'stretch' },
  pillOn: { backgroundColor: tokens.colorAccentTint },
  round: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  monthBox: { flexShrink: 1, minWidth: 0 },
  month: { color: tokens.colorInk },
  menu: { gap: tokens.spaceHair, paddingHorizontal: tokens.spaceXs },
  choice: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spacePillEnd,
    borderRadius: tokens.spaceLg,
  },
  choiceOn: { backgroundColor: tokens.colorAccentTint },
  choicePressed: { backgroundColor: tokens.colorInset },
  tick: { width: 18, alignItems: 'center' },
  spinner: { width: 16, height: 16 },
});
