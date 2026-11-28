import { useMemo } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
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

/** Under a Settings page's title, 16 to its first block as the demo's `SummaryPage` draws it, whatever gap the page keeps between its blocks (sc-49170). */
export function titleFoot(page: StyleProp<ViewStyle>): ViewStyle {
  const gap = StyleSheet.flatten(page)?.gap;

  return { marginBottom: tokens.spaceXl - (typeof gap === 'number' ? gap : 0) };
}

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

/** A Settings page's title in the pane on its side: 14 above it and 16 under it, as the demo's `SummaryPage` draws it, so it stands 40 from the pane's top and its first block 34 under it (sc-39471, "Decided, 24 Nov"). */
export const PANE_TITLE_ROW = { paddingTop: 14, paddingBottom: tokens.spaceXl } as const;

/** On its side: the grey ground the sidebar sits on, the white card the screen sits in, and the card's margin when no sidebar sits beside it. */
export function useSideFrame() {
  const insets = useSafeAreaInsets();

  return useMemo(
    () => ({
      chrome: [styles.chrome, { paddingTop: insets.top }],
      card: [styles.card, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }],
      alone: styles.alone,
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
  alone: { marginLeft: tokens.spaceMd },
});
