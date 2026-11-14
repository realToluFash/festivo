import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { setBoldText, useBoldTextSwitch, useBoldTextBoardOpen } from './boldTextStore.ts';

/** The phone's own setting stands in here: the dashed edge says the product has no such control. */
export function BoldTextSwitch() {
  const on = useBoldTextSwitch();

  return (
    <Pressable
      onPress={() => setBoldText(!on)}
      style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && styles.pressed]}
      accessibilityRole="switch"
      accessibilityLabel="Bold text"
      accessibilityState={{ checked: on }}
      testID="demo.boldText.switch"
    >
      <Text size={tokens.typeSmall.size} weight="semibold" accessible={false}>
        {on ? 'Bold text · On' : 'Bold text · Off'}
      </Text>
    </Pressable>
  );
}

/** A screen the board opens, redrawn as the switch turns: what was typed, and Show, are kept. The switch sits in the top row's free side, so it covers none of the text QA reads. */
export function withBoldText<Props extends object>(
  Screen: ComponentType<Props>,
  side: 'left' | 'right' = 'right',
) {
  return function WithBoldText(props: Props) {
    useBoldTextSwitch();
    const open = useBoldTextBoardOpen();
    const { top } = useSafeAreaInsets();

    return (
      <View style={styles.fill}>
        <Screen {...props} />
        {open && (
          <View
            style={[
              styles.floating,
              side === 'left' ? styles.left : styles.right,
              { top: top + tokens.spaceXs },
            ]}
            pointerEvents="box-none"
          >
            <BoldTextSwitch />
          </View>
        )}
      </View>
    );
  };
}

/** Clear of the bell at the top right of Today and Settings. */
const PAST_THE_BELL = 72;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  floating: { position: 'absolute' },
  left: { left: tokens.spaceXl },
  right: { right: PAST_THE_BELL },
  pill: {
    minHeight: tokens.sizeHit,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkSecondary,
    backgroundColor: tokens.colorCard,
  },
  pillOn: { backgroundColor: tokens.colorAccentTint },
  pressed: { opacity: 0.7 },
});
