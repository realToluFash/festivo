import { Pressable, StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

/** A switch with its visible On or Off, so its state is never colour alone; with no state yet it shows neither. */
export function OnOffSwitch({
  on,
  words,
  label,
  hint,
  disabled = false,
  busy = false,
  onChange,
  testID,
}: {
  on: boolean | null;
  words: { on: string; off: string };
  label: string;
  hint?: string;
  disabled?: boolean;
  busy?: boolean;
  onChange: (next: boolean) => void;
  testID: string;
}) {
  const lit = on === true;
  const off = disabled || busy || on == null;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: lit, disabled: off, busy }}
      disabled={off}
      onPress={() => onChange(!lit)}
      hitSlop={tokens.spaceSm}
      style={[styles.switch, lit && styles.switchOn, disabled && styles.locked]}
      testID={testID}
    >
      <View style={[styles.dot, lit ? styles.dotOn : styles.dotOff]} />
      {on != null && (
        <Text
          size={tokens.typeButton.size}
          weight="semibold"
          style={lit ? styles.inkOn : styles.inkOff}
        >
          {lit ? words.on : words.off}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  switchOn: { backgroundColor: tokens.colorAccentTint },
  locked: { opacity: 0.6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: tokens.colorAccent },
  dotOff: { borderWidth: 1.5, borderColor: tokens.colorMarkEmpty },
  inkOn: { color: tokens.colorAccentText },
  inkOff: { color: tokens.colorInkSecondary },
});
