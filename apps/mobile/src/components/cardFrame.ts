import { StyleSheet } from 'react-native';

import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';

/** The frame every Security and Account card is drawn in, so the stack lines up on every layout. */
export function cardFrame(kind: LayoutKind) {
  return [styles.card, kind === 'tabletLandscape' ? styles.wide : styles.narrow];
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  narrow: { padding: tokens.spaceXxl },
  wide: { padding: tokens.space3xl, maxWidth: 640 },
});
