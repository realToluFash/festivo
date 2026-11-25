import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';

const SHAPE = 12;

/** Open is a hollow circle; Lost a square struck through, so the status never rests on colour. */
export function StatusShape({ lost, ink = tokens.colorInk }: { lost: boolean; ink?: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.shape, { borderColor: ink }, lost ? styles.square : styles.circle]}
    >
      {lost && <View style={[styles.strike, { backgroundColor: ink }]} />}
    </View>
  );
}

export function StatusLine({ lost, words }: { lost: boolean; words: string }) {
  return (
    <View style={styles.status} accessible accessibilityLabel={words} testID="enquiry.status">
      <StatusShape lost={lost} />
      <Text size={16} weight="semibold" accessible={false}>
        {words}
      </Text>
    </View>
  );
}

/** One of a few, the lit one ticked; tapping it again clears the choice. */
export function Chips<Key extends string>({
  items,
  on,
  onPick,
  off = false,
  testID,
}: {
  items: readonly { key: Key; title: string }[];
  on: Key | null;
  onPick: (key: Key | null) => void;
  off?: boolean;
  testID: string;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {items.map((item) => {
        const lit = item.key === on;

        return (
          <Pressable
            key={item.key}
            onPress={() => !off && onPick(lit ? null : item.key)}
            style={({ pressed }) => [styles.chip, lit && styles.chipOn, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ checked: lit, disabled: off }}
            accessibilityLabel={item.title}
            testID={`${testID}.${item.key}`}
          >
            {lit && <Glyph name="tick" size={14} ink={tokens.colorAccentText} weight={2.6} />}
            <Text
              size={15}
              weight={lit ? 'semibold' : 'medium'}
              accessible={false}
              style={lit ? styles.accent : undefined}
            >
              {item.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A section: a card on the wide layouts, flat on white on the phone. */
export function PagePart({
  wide,
  title,
  right,
  children,
  testID,
}: {
  wide: boolean;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  testID: string;
}) {
  return (
    <View style={[styles.part, wide && styles.card]} testID={testID}>
      <View style={styles.partHead}>
        <Text size={18} weight="bold" accessibilityRole="header" style={styles.grow}>
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Fact({ label, value, given }: { label: string; value: string; given: boolean }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text size={14} weight="semibold" style={styles.secondary} accessible={false}>
        {label}
      </Text>
      <Text
        size={16}
        weight="medium"
        style={[styles.figures, !given && styles.secondary]}
        accessible={false}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  shape: { width: SHAPE, height: SHAPE, borderWidth: 2, overflow: 'hidden' },
  circle: { borderRadius: SHAPE / 2 },
  square: { borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  strike: { width: SHAPE * 1.5, height: 2, transform: [{ rotate: '-45deg' }] },
  status: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  chip: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.sizeHit / 2,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  chipOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccentTint },
  part: { gap: tokens.spaceMd },
  card: {
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  partHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  fact: { gap: 2 },
});
