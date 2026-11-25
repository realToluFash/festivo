import { type ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/Buttons.tsx';
import { tokens } from '../../theme/tokens.ts';

/** The joining flow's primary, turning at its leading edge while the code is checked or sent, as Access-A-Phone-Joining draws it (sc-31774). The kit's busy primary draws no spinner, so the demo lays one over it. */
export function TurningButton(props: ComponentProps<typeof PrimaryButton>) {
  return (
    <View>
      <PrimaryButton {...props} />
      {props.busy === true && (
        <View style={styles.turn} pointerEvents="none" testID={`${props.testID}.turning`}>
          <ActivityIndicator
            color={tokens.colorInkOnDark}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  turn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: tokens.spaceXxl,
    justifyContent: 'center',
  },
});
