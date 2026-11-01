import type { StatusLook, StatusShape, StatusTone } from '@soirely/domain';
import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

/** A state as a pill with a shape and its word, never colour alone (WCAG 2.2, 1.4.1); the pill grows with its word. */
export function StatusChip({
  look,
  word,
  testID,
}: {
  look: StatusLook;
  word: string;
  testID?: string | undefined;
}) {
  return (
    <View style={[styles.chip, CHIP[look.tone]]} testID={testID}>
      <Shape shape={look.shape} tone={look.tone} />
      <Text size={tokens.typeSmall.size} weight="semibold" style={{ color: INK[look.tone] }}>
        {word}
      </Text>
    </View>
  );
}

function Shape({ shape, tone }: { shape: StatusShape; tone: StatusTone }) {
  const ink = INK[tone];
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const;

  switch (shape) {
    case 'ring':
      return <View style={[styles.ring, { borderColor: ink }]} {...hidden} />;
    case 'dot':
      return (
        <View
          style={[styles.dot, { backgroundColor: tone === 'accent' ? tokens.colorAccent : ink }]}
          {...hidden}
        />
      );
    case 'half':
      return (
        <View style={[styles.ring, { borderColor: ink }]} {...hidden}>
          <View style={[styles.half, { backgroundColor: ink }]} />
        </View>
      );
    case 'bars':
      return (
        <View style={styles.bars} {...hidden}>
          <View style={[styles.bar, { backgroundColor: ink }]} />
          <View style={[styles.bar, { backgroundColor: ink }]} />
        </View>
      );
    case 'tick':
    case 'cross':
    case 'dash':
      return (
        <Text
          size={tokens.typeSmall.size}
          weight="bold"
          style={{ color: ink }}
          {...hidden}
          accessible={false}
        >
          {GLYPH[shape]}
        </Text>
      );
  }
}

const GLYPH = { tick: '✓', cross: '✕', dash: '–' } as const;

const INK: Record<StatusTone, string> = {
  accent: tokens.colorAccentText,
  attention: tokens.colorAttentionText,
  paused: tokens.colorPausedText,
  broken: tokens.colorBrokenText,
  neutral: tokens.colorInkSecondary,
};

const CHIP = StyleSheet.create({
  accent: { borderColor: tokens.colorAccentTintBorder, backgroundColor: tokens.colorAccentTint },
  attention: {
    borderColor: tokens.colorAttentionBorder,
    backgroundColor: tokens.colorAttentionTint,
  },
  paused: { borderColor: tokens.colorHeaderBorder, backgroundColor: tokens.colorPausedTint },
  broken: { borderColor: tokens.colorBrokenTint, backgroundColor: tokens.colorBrokenTint },
  neutral: { borderColor: tokens.colorNeutralFill, backgroundColor: tokens.colorNeutralFill },
});

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: tokens.spaceXxs,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: tokens.radiusPill },
  ring: {
    width: 10,
    height: 10,
    borderRadius: tokens.radiusPill,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  half: { width: '50%', height: '100%' },
  bars: { flexDirection: 'row', gap: 2 },
  bar: { width: 3, height: 10, borderRadius: 1 },
});
