import { useEffect, useState } from 'react';
import { type DimensionValue, StyleSheet, View } from 'react-native';

import { Notice } from '../../components/Notice.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Card, Pill, TYPE } from './parts.tsx';
import type { Load } from './RolesSample.ts';

const ROW_BARS: readonly [DimensionValue, DimensionValue][] = [
  ['58%', '38%'],
  ['46%', '52%'],
  ['64%', '34%'],
  ['50%', '44%'],
];

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** The rows' shape under the loading words, for Members and Roles. */
export function LoadingRows({ words, picture = true }: { words: string; picture?: boolean }) {
  useReadOut(words);

  return (
    <View style={styles.stack}>
      <Text size={TYPE.line} weight="medium" style={styles.secondary}>
        {words}
      </Text>
      <View style={styles.rows} {...hidden}>
        {ROW_BARS.map(([first, second], index) => (
          <View key={index} style={[styles.row, index > 0 && styles.divided]}>
            {picture && <View style={styles.disc} />}
            <View style={styles.bars}>
              <View style={[styles.bar, { width: first }]} />
              <View style={[styles.barThin, { width: second }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Cards' shapes under the loading words: a heading bar over its options, then lines. */
export function LoadingCards({
  words,
  cards,
}: {
  words: string;
  cards: readonly { head: DimensionValue; options: number }[];
}) {
  useReadOut(words);

  return (
    <View style={styles.stack}>
      <Text size={TYPE.line} weight="medium" style={styles.secondary}>
        {words}
      </Text>
      <View style={styles.stack} {...hidden}>
        {cards.map(({ head, options }, index) => (
          <Card key={index} gap={12}>
            <View style={[styles.bar, { width: head }]} />
            {Array.from({ length: options }, (_, option) => (
              <View key={option} style={styles.option} />
            ))}
          </Card>
        ))}
        <Card gap={12}>
          <View style={[styles.bar, { width: '88%' }]} />
          <View style={[styles.bar, { width: '64%' }]} />
        </Card>
      </View>
    </View>
  );
}

/** A page that did not load: what went wrong, then Try again. */
export function Failed({
  words,
  onRetry,
  testID,
}: {
  words: string;
  onRetry: () => void;
  testID: string;
}) {
  return (
    <View style={styles.stack}>
      <Notice tone="broken" mark={tokens.marks.broken.glyph} title={words} announce />
      <Pill label="Try again" kind="secondary" onPress={onRetry} testID={testID} />
    </View>
  );
}

const RETRY_MS = 1200;

/** Loading and failing stay put for a link to show them; Try again loads after a moment. */
export function useLoad(start: Load): { load: Load; retry: () => void } {
  const [load, setLoad] = useState<Load>(start);

  useEffect(() => {
    if (load !== 'retrying') return;
    const timer = setTimeout(() => setLoad('loaded'), RETRY_MS);

    return () => clearTimeout(timer);
  }, [load]);

  return { load, retry: () => setLoad('retrying') };
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceLg },
  secondary: { color: tokens.colorInkSecondary },
  rows: {
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorInset,
    paddingVertical: tokens.spaceXxs,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
  },
  divided: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  disc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colorNeutralFill,
  },
  bars: { flex: 1, gap: tokens.spaceSm },
  bar: { height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
  barThin: { height: 10, borderRadius: 5, backgroundColor: tokens.colorNeutralFill },
  option: { height: 52, borderRadius: tokens.spaceXl, backgroundColor: tokens.colorCard },
});
