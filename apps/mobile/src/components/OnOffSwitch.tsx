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
  stacked = false,
  steady = false,
  onChange,
  testID,
}: {
  on: boolean | null;
  words: { on: string; off: string };
  label: string;
  hint?: string;
  disabled?: boolean;
  busy?: boolean;
  stacked?: boolean;
  steady?: boolean;
  onChange: (next: boolean) => void;
  testID: string;
}) {
  const lit = on === true;
  const off = disabled || busy || on == null;
  const dot = <View style={[styles.dot, lit ? styles.dotOn : styles.dotOff]} />;
  const pill = [styles.pill, lit && styles.pillOn];

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: lit, disabled: off, busy }}
      disabled={off}
      onPress={() => onChange(!lit)}
      hitSlop={tokens.spaceSm}
      style={[stacked ? styles.stacked : [styles.beside, pill], disabled && styles.locked]}
      testID={testID}
    >
      {stacked ? <View style={[styles.track, pill]}>{dot}</View> : dot}
      {on != null && (
        <View>
          <Text
            size={tokens.typeButton.size}
            weight="semibold"
            style={[stacked && styles.centred, lit ? styles.inkOn : styles.inkOff]}
          >
            {lit ? words.on : words.off}
          </Text>
          {steady && (
            <Text
              size={tokens.typeButton.size}
              weight="semibold"
              style={styles.reserved}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              accessible={false}
            >
              {lit ? words.off : words.on}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  beside: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
  },
  stacked: {
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizeHit,
  },
  pill: {
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  pillOn: { backgroundColor: tokens.colorAccentTint },
  track: {
    width: tokens.sizeHit,
    paddingVertical: tokens.spaceXs,
    alignItems: 'center',
  },
  locked: { opacity: 0.6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: tokens.colorAccent },
  dotOff: { borderWidth: 1.5, borderColor: tokens.colorMarkEmpty },
  centred: { textAlign: 'center' },
  reserved: { height: 0, opacity: 0 },
  inkOn: { color: tokens.colorAccentText },
  inkOff: { color: tokens.colorInkSecondary },
});
