import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { Initials } from './Initials.tsx';

/** The tile before the organisation exists: Tint with a dashed Violet rim, a plus until the first letter. */
export function DraftTile({
  name,
  side,
  radius,
  initials,
  style,
}: {
  name: string;
  side: number;
  radius: number;
  initials: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[styles.tile, { width: side, height: side, borderRadius: radius }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {name.trim() === '' ? (
        <Glyph
          name="plus"
          size={Math.round(side * 0.4)}
          ink={tokens.colorAccentText}
          weight={2.4}
        />
      ) : (
        <Initials name={name} size={initials} weight="bold" style={styles.ink} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  ink: { color: tokens.colorAccentText },
});
