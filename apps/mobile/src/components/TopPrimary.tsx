import { Pressable, StyleSheet } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { Pill } from './SettingsParts.tsx';

export interface TopPrimaryProps {
  label: string;
  onPress: () => void;
  testID: string;
}

/** The primary at the end of a top's title row, as the demos draw it: the round violet + on a phone, the + and its label wider (sc-39471). */
export function TopPrimary({ label, onPress, wide, testID }: TopPrimaryProps & { wide: boolean }) {
  if (wide)
    return (
      <Pill
        label={label}
        glyph="plus"
        height={tokens.sizeHit}
        full={false}
        onPress={onPress}
        testID={testID}
      />
    );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Glyph name="plus" size={20} ink={tokens.colorInkOnDark} weight={2.6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: tokens.opacityPressed },
  round: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccent,
  },
});
