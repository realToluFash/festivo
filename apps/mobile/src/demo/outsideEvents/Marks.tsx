import { StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { WORDS } from './OutsideModel.ts';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

export function UnderWay() {
  return (
    <View style={styles.pill} {...hidden} testID="outside.underWay">
      <View style={styles.dot} />
      <Text size={12.5} weight="semibold" style={styles.ink}>
        {WORDS.underWay}
      </Text>
    </View>
  );
}

export function YoureHere() {
  return (
    <View style={styles.here} {...hidden} testID="outside.here">
      <Glyph name="tick" size={14} ink={tokens.colorAccentText} weight={2.8} />
      <Text size={12.5} weight="semibold" style={styles.ink}>
        {WORDS.here}
      </Text>
    </View>
  );
}

export function Marks({ underWay, here }: { underWay: boolean; here: boolean }) {
  if (!underWay && !here) return null;

  return (
    <View style={styles.marks}>
      {underWay && <UnderWay />}
      {here && <YoureHere />}
    </View>
  );
}

const styles = StyleSheet.create({
  marks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceSm,
    marginTop: tokens.spaceXs,
  },
  pill: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 9,
    borderRadius: 12,
    backgroundColor: tokens.colorAccentTint,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  here: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 5 },
  ink: { color: tokens.colorAccentText },
});
