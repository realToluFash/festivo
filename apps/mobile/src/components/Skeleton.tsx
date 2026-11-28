import { type ReactNode, useEffect, useLayoutEffect, useState } from 'react';
import { Animated, StyleSheet, View, type ViewStyle, useWindowDimensions } from 'react-native';

import {
  SKELETON_AFTER_MS,
  type SkeletonRowHeight,
  barWidths,
  fillingRows,
} from '../kit/skeleton.ts';
import { useLayout } from '../layout/useLayout.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { cardFrame } from './cardFrame.ts';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';
import { useShownAfter } from './useShownAfter.ts';

export type CardShape = { lines?: number; fields?: number; options?: number; cover?: boolean };

type Shape =
  | { shape: 'rows'; rowHeight: SkeletonRowHeight; picture?: boolean; rows?: number }
  | { shape: 'cards'; cards: readonly CardShape[]; titled?: boolean };

/** Nothing for a second, then the content's shape under its loading words; `inCard` draws inside a card already there, `edgeToEdge` inside one with no side padding, so the words take the rows' inset. */
export function Skeleton({
  words,
  inCard = false,
  edgeToEdge = false,
  ...shape
}: Shape & { words: string; inCard?: boolean; edgeToEdge?: boolean }) {
  const shown = useShownAfter(SKELETON_AFTER_MS);
  const appear = useAppear();
  const pulse = usePulse(shown);
  const [blocksOpacity] = useState(() => Animated.multiply(appear, pulse));
  const { kind } = useLayout();
  const { height } = useWindowDimensions();

  useReadOut(shown ? words : null);

  const blocks =
    shape.shape === 'rows' ? (
      <View style={inCard ? null : [cardFrame(kind), styles.rowsCard]}>
        {Array.from(
          { length: shape.rows ?? fillingRows(height - 260, shape.rowHeight) },
          (_, row) => {
            const [first, second] = barWidths(row);

            return (
              <View
                key={row}
                style={[styles.row, { height: shape.rowHeight }, row > 0 && styles.rowDivided]}
              >
                {shape.picture === true && <View style={[styles.block, styles.tile]} />}
                <View style={styles.rowBars}>
                  <View style={[styles.block, styles.barFirst, { width: first }]} />
                  <View style={[styles.block, styles.barSecond, { width: second }]} />
                </View>
              </View>
            );
          },
        )}
      </View>
    ) : (
      shape.cards.map((card, index) => (
        <Card
          key={index}
          card={card}
          titled={index === 0 && shape.titled === true}
          framed={!inCard}
        />
      ))
    );

  return (
    <View accessibilityState={{ busy: true }} style={styles.skeleton}>
      <Animated.View
        accessibilityElementsHidden={!shown}
        importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
        style={{ opacity: appear }}
      >
        <Text size={tokens.typeBodyPhone.size} muted style={edgeToEdge && styles.wordsInset}>
          {words}
        </Text>
      </Animated.View>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.blocks, { opacity: blocksOpacity }]}
      >
        {blocks}
      </Animated.View>
    </View>
  );
}

function Card({ card, titled, framed }: { card: CardShape; titled: boolean; framed: boolean }) {
  const { kind } = useLayout();
  const { lines = 2, fields = 0, options = 0, cover = false } = card;

  return (
    <View style={framed ? cardFrame(kind) : styles.cardInner}>
      {cover && <View style={[styles.block, styles.cover]} />}
      <View style={[styles.block, titled ? styles.title : styles.heading]} />
      {Array.from({ length: lines }, (_, index) => (
        <View
          key={`line-${index}`}
          style={[styles.block, styles.line, { width: LINE_WIDTHS[index % LINE_WIDTHS.length] }]}
        />
      ))}
      {Array.from({ length: fields }, (_, index) => (
        <View key={`field-${index}`} style={[styles.block, styles.field]} />
      ))}
      {Array.from({ length: options }, (_, index) => (
        <View key={`option-${index}`} style={[styles.block, styles.option]} />
      ))}
    </View>
  );
}

const LINE_WIDTHS = ['92%', '78%', '64%'] as const;

/** Holds what a load brought, fading it in where its skeleton stood; at once when less motion is asked for. */
export function Arrived({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(0));
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (settled) return;
    const run = Animated.timing(shown, {
      toValue: 1,
      duration: reduced ? 0 : tokens.motionBase,
      useNativeDriver: true,
    });
    run.start(({ finished }) => {
      if (finished) setSettled(true);
    });

    return () => run.stop();
  }, [settled, reduced, shown]);

  // A native opacity never reaches the view's committed props, so letting go of it short of 1 leaves the page unseen until something re-commits it (sc-48600): it goes only once a run has carried it to 1, the reduced-motion run included.
  return <Animated.View style={[style, !settled && { opacity: shown }]}>{children}</Animated.View>;
}

/** 0 for SKELETON_AFTER_MS, then 1, played on the UI thread: a JS timer here fired seconds late on a cold start, leaving the loading state blank (sc-83081). */
function useAppear(): Animated.Value {
  const [appear] = useState(() => new Animated.Value(0));

  useLayoutEffect(() => {
    const run = Animated.timing(appear, {
      toValue: 1,
      duration: SKELETON_AFTER_MS,
      easing: (progress) => (progress < 1 ? 0 : 1),
      useNativeDriver: true,
    });
    run.start();

    return () => run.stop();
  }, [appear]);

  return appear;
}

function usePulse(running: boolean): Animated.Value {
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!running || reduced) {
      opacity.setValue(1);
      return;
    }
    const half = tokens.motionPulse / 2;
    const run = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: tokens.opacityPulse,
          duration: half,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 1, duration: half, useNativeDriver: true }),
      ]),
      { iterations: tokens.motionPulseTimes },
    );
    run.start();

    return () => run.stop();
  }, [running, reduced, opacity]);

  return opacity;
}

const styles = StyleSheet.create({
  skeleton: { gap: tokens.spaceLg },
  wordsInset: { paddingHorizontal: tokens.spaceXl },
  blocks: { gap: tokens.spaceXl },
  rowsCard: { padding: 0, gap: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder },
  rowBars: { flex: 1, gap: tokens.spaceSm },
  block: {
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    borderRadius: tokens.radiusSmall,
  },
  tile: { width: 40, height: 40, borderRadius: 10 },
  barFirst: { height: 14 },
  barSecond: { height: 12 },
  cardInner: { gap: tokens.spaceMd },
  cover: { height: 140 },
  title: { height: 24, width: '42%' },
  heading: { height: 18, width: '36%' },
  line: { height: 12 },
  field: { height: 48, borderRadius: tokens.radiusRow },
  option: { height: 52 },
});
