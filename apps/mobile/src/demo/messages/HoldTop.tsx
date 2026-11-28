import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

/** Set by the phone's conversation: where a block that must open whole sits in its stream. */
export const HoldTop = createContext<((y: number | null) => void) | null>(null);

/** A block the phone scrolls to from its top, not past it, when it is taller than the screen. */
export function Held({ children }: { children: ReactNode }) {
  const hold = useContext(HoldTop);

  useEffect(() => () => hold?.(null), [hold]);

  return (
    <View
      style={styles.held}
      onLayout={hold == null ? undefined : (event) => hold(event.nativeEvent.layout.y)}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  held: { gap: 14 },
});
