import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
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
