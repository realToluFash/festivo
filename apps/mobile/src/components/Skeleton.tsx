import { type ReactNode, useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type ViewStyle, useWindowDimensions } from 'react-native';

import {
  SKELETON_AFTER_MS,
  type SkeletonRowHeight,
  barWidths,
  fillingRows,
} from '../kit/skeleton.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { calendarGrid } from './calendarGrid.ts';
import { cardFrame } from './cardFrame.ts';
import { EventCardGrid } from './EventCardGrid.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';
import { useShownAfter } from './useShownAfter.ts';

export type CardShape = { lines?: number; fields?: number; options?: number; cover?: boolean };

type Shape =
  | { shape: 'rows'; rowHeight: SkeletonRowHeight; picture?: boolean; rows?: number }
  | { shape: 'cards'; cards: readonly CardShape[]; titled?: boolean }
  | { shape: 'month'; weeks: number }
  | { shape: 'eventCards'; kind: LayoutKind };

/** Nothing for a second, then the content's shape under its loading words; `inCard` draws inside a card already there, `edgeToEdge` inside one with no side padding, so the words take the rows' inset. */
export function Skeleton({
  words,
  inCard = false,
  edgeToEdge = false,
  ...shape
}: Shape & { words: string; inCard?: boolean; edgeToEdge?: boolean }) {
  const shown = useShownAfter(SKELETON_AFTER_MS);
  const pulse = usePulse(shown);
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
    ) : shape.shape === 'month' ? (
      <Month weeks={shape.weeks} phone={kind === 'phone'} />
    ) : shape.shape === 'eventCards' ? (
      <EventCards kind={shape.kind} />
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
      {shown && (
        <Text size={tokens.typeBodyPhone.size} muted style={edgeToEdge && styles.wordsInset}>
          {words}
        </Text>
      )}
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.blocks, { opacity: shown ? pulse : 0 }]}
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

/** The month grid's own card and cells, one bar where each weekday and each day number will be; never a button. */
function Month({ weeks, phone }: { weeks: number; phone: boolean }) {
  const days = Array.from({ length: 7 }, (_, index) => index);

  return (
    <View style={calendarGrid.grid}>
      <View style={calendarGrid.week}>
        {days.map((index) => (
          <View key={index} style={[calendarGrid.head, styles.monthHead]}>
            <View style={[styles.block, styles.monthBar, { width: phone ? 12 : 24 }]} />
          </View>
        ))}
      </View>
      {Array.from({ length: weeks }, (_, week) => (
        <View key={week} style={calendarGrid.week}>
          {days.map((index) => (
            <View key={index} style={[calendarGrid.cell, phone && calendarGrid.cellPhone]}>
              <View style={calendarGrid.number}>
                <View style={[styles.block, styles.monthBar, styles.dayBar]} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Events' cards while they load, each a column wide as the loaded ones are: three on the tablets, four on the phones (sc-22103). */
function EventCards({ kind }: { kind: LayoutKind }) {
  const phone = kind === 'phone';

  return (
    <EventCardGrid kind={kind}>
      {(width) =>
        Array.from({ length: phone ? 4 : 3 }, (_, index) => (
          <View key={index} style={[styles.eventCard, phone && styles.eventCardPhone, { width }]}>
            <View style={styles.eventCardTop}>
              <View style={[styles.block, styles.eventChip, { width: phone ? 64 : 70 }]} />
              {!phone && <View style={[styles.block, styles.eventDate]} />}
            </View>
            <View style={[styles.block, styles.eventName, { width: phone ? '85%' : '80%' }]} />
            <View style={[styles.block, styles.eventLine, { width: phone ? '60%' : '90%' }]} />
          </View>
        ))
      }
    </EventCardGrid>
  );
}

const LINE_WIDTHS = ['92%', '78%', '64%'] as const;

/** Holds what a load brought, fading it in where its skeleton stood; at once when less motion is asked for. */
export function Arrived({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) {
      shown.setValue(1);
      return;
    }
    const run = Animated.timing(shown, {
      toValue: 1,
      duration: tokens.motionBase,
      useNativeDriver: true,
    });
    run.start();

    return () => run.stop();
  }, [reduced, shown]);

  return <Animated.View style={[style, { opacity: shown }]}>{children}</Animated.View>;
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
  monthHead: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: tokens.typeMeta.size * tokens.typeMeta.lineHeight + 2 * tokens.spaceSm,
  },
  monthBar: { height: 12 },
  dayBar: { width: 16 },
  eventCard: {
    gap: tokens.spaceLg,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  eventCardPhone: { padding: 14 },
  eventCardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  eventChip: { height: 22, borderRadius: tokens.radiusPill },
  eventDate: { width: 60, height: 12 },
  eventName: { height: 15 },
  eventLine: { height: 13 },
});
