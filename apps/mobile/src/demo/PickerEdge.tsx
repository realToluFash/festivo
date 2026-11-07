import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFocusEdge } from '../components/Field.tsx';
import { tokens } from '../theme/tokens.ts';

/** A refused text field's red edge over a picker the demo cannot change, 2pt with focus (sc-30447). */
// Boxed, it covers the picker's own border and focus edge exactly; `flat` reaches past a flat row, as a lit row does.
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
      {wrong && (
        <View
          pointerEvents="none"
          style={[styles.edge, flat && styles.flat, focused && styles.focused]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  edge: {
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
    top: tokens.spaceXxs,
    right: -tokens.spaceMd,
    bottom: tokens.spaceXxs,
    left: -tokens.spaceMd,
    borderRadius: tokens.radiusRow,
  },
  focused: { borderWidth: 2 },
});
