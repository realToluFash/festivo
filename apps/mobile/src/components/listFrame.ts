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

/** The Settings list's column on its side, the rule at its right; Members' own list takes the same column (sc-39471). */
export const SETTINGS_COLUMN = {
  backgroundColor: tokens.colorCard,
  borderRightWidth: 1,
  borderRightColor: tokens.colorBorder,
} as const;

/** Where a Settings page's body starts and ends in each layout, as the demo's `SummaryPage` draws it: 2 × 6xl past its last block (sc-39471). */
export const SETTINGS_PAGE = StyleSheet.create({
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.space6xl * 2,
  },
  tabletPortrait: {
    gap: tokens.spaceXl,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl * 2,
  },
  tabletLandscape: {
    gap: LIST_GAP,
    paddingTop: 26,
    paddingHorizontal: 30,
    paddingBottom: tokens.space6xl * 2,
  },
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
