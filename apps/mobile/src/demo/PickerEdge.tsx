import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { FocusEdge, useFocusEdge } from '../components/Field.tsx';
import { tokens } from '../theme/tokens.ts';

/** A refused text field's red edge over a picker the demo cannot change, 2pt with focus (sc-30447). */
// `flat` goes round a flat row, reaching past it as a lit row does, so nothing in it moves.
export function PickerEdge({
  wrong,
  flat = false,
  children,
}: {
  wrong: boolean;
  flat?: boolean;
  children: ReactNode;
}) {
  const { focused, edging } = useFocusEdge();

  return (
    <View {...edging}>
      {children}
      {wrong &&
        (flat ? (
          <View pointerEvents="none" style={[styles.flat, focused && styles.focused]} />
        ) : focused ? (
          <FocusEdge wrong />
        ) : (
          <View pointerEvents="none" style={styles.boxed} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  boxed: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderRadius: tokens.radiusField,
    borderColor: tokens.colorBroken,
  },
  flat: {
    position: 'absolute',
    top: tokens.spaceXxs,
    right: -tokens.spaceMd,
    bottom: tokens.spaceXxs,
    left: -tokens.spaceMd,
    borderWidth: 1,
    borderRadius: tokens.radiusRow,
    borderColor: tokens.colorBroken,
  },
  focused: { borderWidth: 2 },
});
