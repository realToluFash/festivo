import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { Text } from './Text.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** A state shape, always beside its word: a tick, a ring, a half ring, two bars, a ring struck through. */
export type MarkKind = 'yes' | 'notyet' | 'waiting' | 'paused' | 'ended';
export type TagKind = MarkKind | 'now';
export interface RowTag {
  kind: TagKind;
  word: string;
  turning?: boolean;
}

const TAGS: Record<TagKind, { fill: string; ink: string; ring?: string }> = {
  yes: { fill: tokens.colorCard, ink: tokens.colorInk, ring: tokens.colorBorder },
  notyet: { fill: tokens.colorNeutralFill, ink: tokens.colorInkSecondary },
  waiting: { fill: tokens.colorAttentionTint, ink: tokens.colorAttentionText },
  paused: { fill: tokens.colorNeutralFill, ink: tokens.colorInkSecondary },
  ended: { fill: tokens.colorNeutralFill, ink: tokens.colorInkSecondary },
  now: { fill: tokens.colorAccentTint, ink: tokens.colorAccentText },
};

export function ShapeMark({
  kind,
  side = 12,
  ink,
}: {
  kind: MarkKind;
  side?: number;
  ink: string;
}) {
  const round = { width: side, height: side, borderRadius: side / 2 };

  if (kind === 'yes')
    return (
      <View {...hidden} style={[styles.markYes, round]}>
        <Glyph name="tick" size={Math.round(side * 0.7)} ink={tokens.marks.done.ink} weight={3.4} />
      </View>
    );
  if (kind === 'paused') {
    const bar = {
      width: Math.max(3, Math.round(side * 0.24)),
      height: Math.round(side * 0.82),
      backgroundColor: ink,
    };

    return (
      <View
        {...hidden}
        style={[styles.markBars, round, { gap: Math.max(2, Math.round(side * 0.18)) }]}
      >
        <View style={[styles.bar, bar]} />
        <View style={[styles.bar, bar]} />
      </View>
    );
  }

  return (
    <View {...hidden} style={[styles.markRing, round, { borderColor: ink }]}>
      {kind === 'waiting' && <View style={[styles.halfFill, { backgroundColor: ink }]} />}
      {kind === 'ended' && (
        <View style={[styles.dash, { width: Math.round(side * 0.46), backgroundColor: ink }]} />
      )}
    </View>
  );
}

const TURN_MS = 900;

/** Something being sent: a 12 pt ring with a quarter turning, still where motion is reduced. */
export function TurningMark({ side = 12 }: { side?: number }) {
  const reduced = useReducedMotion();
  const [turn] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: TURN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();

    return () => loop.stop();
  }, [reduced, turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View {...hidden} style={{ width: side, height: side, transform: [{ rotate }] }}>
      <Svg width={side} height={side} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={9} fill="none" stroke={tokens.colorBorder} strokeWidth={3.4} />
        <Path
          d="M12 3a9 9 0 0 1 9 9"
          fill="none"
          stroke={tokens.colorInkSecondary}
          strokeWidth={3.4}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

/** Beside a title, only when the state is not the rule: a 12 pt shape and its word on a tint. */
export function Tag({
  kind,
  word,
  turning = false,
}: {
  kind: TagKind;
  word: string;
  turning?: boolean | undefined;
}) {
  const look = TAGS[kind];

  return (
    <View
      style={[
        styles.tag,
        { backgroundColor: look.fill, paddingLeft: kind === 'now' && !turning ? 9 : 7 },
        turning && styles.tagTurning,
        look.ring != null && { borderWidth: 1, borderColor: look.ring },
      ]}
    >
      {turning && <TurningMark />}
      {kind !== 'now' && <ShapeMark kind={kind} ink={look.ink} />}
      <Text size={12.5} weight="semibold" numberOfLines={1} style={{ color: look.ink }}>
        {word}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  markYes: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.marks.done.fill,
  },
  markBars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bar: { borderRadius: 1.5 },
  markRing: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  halfFill: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%' },
  dash: { height: 2, borderRadius: 1 },
  tag: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    gap: 5,
    paddingRight: 9,
    borderRadius: 12,
  },
  tagTurning: { gap: tokens.spaceXs },
});
