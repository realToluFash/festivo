import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

export type StatusTone = 'progress' | 'done' | 'broken' | 'skipped';

/** A state as a shape and a word, never colour alone: "… Waiting for an answer", "✓ Confirmed". */
export function StatusMark({ tone, word }: { tone: StatusTone; word: string }) {
  const mark = tokens.marks[tone];

  return (
    <View style={styles.row}>
      <View
        style={[styles.mark, { backgroundColor: mark.fill, borderColor: mark.ring }]}
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
      <Text size={tokens.typeSmall.size} weight="semibold" style={WORD[tone]}>
        {word}
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
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    borderRadius: tokens.sizeMark / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
