import { StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';

const SIZE = tokens.sizeMark + tokens.spaceHair;

export function RadioMark({ on }: { on: boolean }) {
  return (
    <View style={[styles.ring, on && styles.ringOn]}>{on && <View style={styles.dot} />}</View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: tokens.spaceHair,
    borderColor: tokens.colorFieldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorCard,
  },
  ringOn: { borderColor: tokens.colorAccent },
  dot: {
    width: tokens.spaceMd,
    height: tokens.spaceMd,
    borderRadius: tokens.spaceMd / 2,
    backgroundColor: tokens.colorAccent,
  },
});
