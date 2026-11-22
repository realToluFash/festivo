import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { tokens } from '../theme/tokens.ts';

export function Glass({
  children,
  height = 40,
  grows = false,
  style,
  testID,
}: {
  children: ReactNode;
  height?: number;
  /** Taller than `height` when its words wrap, rather than clipped to it. */
  grows?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}) {
  return (
    <View
      testID={testID}
      style={[
        styles.glass,
        grows ? { minHeight: height } : { height },
        { borderRadius: height / 2 },
        style,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, styles.glassFill]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  glassFill: { backgroundColor: tokens.colorInkOnDark, opacity: 0.22 },
});
