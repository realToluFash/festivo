import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LayoutKind } from '../layout/classify.ts';
import { tokens } from '../theme/tokens.ts';

/** The space between a list screen's blocks: its top, search, tabs, card and rows (sc-39471). */
export const LIST_GAP = 18;

/** Where a list screen's top and body start in each layout, as Events' and the Calendar's demos draw them (sc-39471). */
export const LIST_EDGES = StyleSheet.create({
  phone: { paddingTop: tokens.spaceXxs, paddingHorizontal: tokens.spaceXxl },
  tabletPortrait: { paddingTop: 26, paddingHorizontal: tokens.space5xl },
  tabletLandscape: { paddingTop: 26, paddingHorizontal: 30 },
}) satisfies Record<LayoutKind, object>;

/** On its side: the grey ground the sidebar sits on, and the white card the screen sits in. */
export function useSideFrame() {
  const insets = useSafeAreaInsets();

  return useMemo(
    () => ({
      chrome: [styles.chrome, { paddingTop: insets.top }],
      card: [styles.card, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }],
    }),
    [insets.top, insets.bottom],
  );
}

const styles = StyleSheet.create({
  chrome: { flexDirection: 'row', backgroundColor: tokens.colorNeutralFill },
  card: {
    marginRight: tokens.spaceMd,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    overflow: 'hidden',
  },
});
