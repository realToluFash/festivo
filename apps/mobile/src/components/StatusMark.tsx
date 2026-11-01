import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';
import { useMarkSide } from './markSide.ts';

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

const styles = StyleSheet.create({
  mark: {
    borderRadius: tokens.radiusPill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
