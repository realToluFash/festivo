import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { Text } from './Text.tsx';
import { useMarkSide } from './markSide.ts';

export type MarkTone = 'progress' | 'done' | 'broken' | 'skipped';

/** A state as a shape and a word, never colour alone: "… Waiting for an answer", "✓ Confirmed". */
export function StatusMark({ tone, word }: { tone: MarkTone; word: string }) {
  return (
    <View style={styles.row}>
      <GlyphMark mark={tokens.marks[tone]} />
      <Text size={tokens.typeSmall.size} weight="semibold" style={WORD[tone]}>
        {word}
      </Text>
    </View>
  );
}

export interface Mark {
  glyph: string;
  fill: string;
  ring: string;
  ink: string;
}

/** The ringed glyph beside a state's word, grown with the system text size as the glyph in it is. */
export function GlyphMark({ mark, side = tokens.sizeMark }: { mark: Mark; side?: number }) {
  const markSide = useMarkSide(side);

  return (
    <View
      style={[styles.mark, markSide, { backgroundColor: mark.fill, borderColor: mark.ring }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        size={tokens.typePill.size}
        weight="bold"
        style={{ color: mark.ink }}
        accessible={false}
      >
        {mark.glyph}
      </Text>
    </View>
  );
}

const WORD = StyleSheet.create({
  progress: { color: tokens.colorAttentionText },
  done: { color: tokens.colorAccentText },
  broken: { color: tokens.colorBrokenText },
  skipped: { color: tokens.colorInkSecondary },
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  mark: {
    borderRadius: tokens.radiusPill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** A state shape, always beside its word: a tick, a ring, a half ring, two bars, a ring struck through. */
export type MarkKind = 'yes' | 'notyet' | 'waiting' | 'paused' | 'ended';

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
      <View {...hidden} style={[shapes.markYes, round]}>
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
        style={[shapes.markBars, round, { gap: Math.max(2, Math.round(side * 0.18)) }]}
      >
        <View style={[shapes.bar, bar]} />
        <View style={[shapes.bar, bar]} />
      </View>
    );
  }

  return (
    <View {...hidden} style={[shapes.markRing, round, { borderColor: ink }]}>
      {kind === 'waiting' && <View style={[shapes.halfFill, { backgroundColor: ink }]} />}
      {kind === 'ended' && (
        <View style={[shapes.dash, { width: Math.round(side * 0.46), backgroundColor: ink }]} />
      )}
    </View>
  );
}

const shapes = StyleSheet.create({
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
});
