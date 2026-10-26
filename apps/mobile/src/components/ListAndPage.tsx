import type { ReactElement, ReactNode } from 'react';
import {
  type RefreshControlProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useLayout, useSideListWidth } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { bodyEdges } from './bodyEdges.ts';
import { QuietButton } from './Buttons.tsx';
import { Screen, ScrollColumn } from './Screen.tsx';

export interface ListAndPageSpacing {
  phone: StyleProp<ViewStyle>;
  tabletPortrait: StyleProp<ViewStyle>;
  /** Around the heading and both columns on a tablet on its side. */
  landscape: ViewStyle;
  /** Each column's content on a tablet on its side. */
  column: StyleProp<ViewStyle>;
  listWidth: number;
  between: number;
}

export interface ListAndPageProps {
  heading: ReactNode;
  /** Beside the heading on a tablet on its side, and nowhere otherwise. */
  besideHeading?: ReactNode;
  list: ReactNode;
  /** Pulling the list down. */
  listRefresh?: ReactElement<RefreshControlProps> | undefined;
  page: ReactNode;
  /** Changes with the page, so a page opened after a longer one shows from its top. */
  pageKey: string;
  /** On a phone and a tablet held upright, whether the page shows in place of the list. */
  pageInFront: boolean;
  /** On a tablet held upright, the page under the list in one column, with no back (Events, sc-1593). */
  pageBelowUpright?: boolean;
  back: { label: string; onPress: () => void; testID: string };
  spacing: ListAndPageSpacing;
}

// The half behind is out of the layout, so neither touch, TalkBack nor Tab reaches it.
export function ListAndPage({
  heading,
  besideHeading,
  list,
  listRefresh,
  page,
  pageKey,
  pageInFront,
  pageBelowUpright = false,
  back,
  spacing,
}: ListAndPageProps) {
  const { kind } = useLayout();
  const listWidth = useSideListWidth(spacing.listWidth);
  const landscape = kind === 'tabletLandscape';
  const column = landscape
    ? spacing.column
    : kind === 'phone'
      ? spacing.phone
      : spacing.tabletPortrait;

  if (kind === 'tabletPortrait' && pageBelowUpright) {
    return (
      <Screen edges={bodyEdges(kind)} scroll={false} contentStyle={styles.bare}>
        <ScrollColumn
          style={styles.fill}
          contentContainerStyle={column}
          refreshControl={listRefresh}
        >
          {heading}
          {list}
          {page}
        </ScrollColumn>
      </Screen>
    );
  }

  return (
    <Screen
      edges={bodyEdges(kind)}
      scroll={false}
      contentStyle={landscape ? spacing.landscape : styles.bare}
    >
      {landscape && (
        <View style={styles.head}>
          <View style={styles.fill}>{heading}</View>
          {besideHeading}
        </View>
      )}
      <View style={landscape ? [styles.split, { gap: spacing.between }] : styles.fill}>
        <View
          style={[
            landscape ? { width: listWidth } : styles.fill,
            !landscape && pageInFront && styles.behind,
          ]}
        >
          <ScrollColumn
            style={styles.fill}
            contentContainerStyle={column}
            refreshControl={listRefresh}
          >
            {!landscape && heading}
            {list}
          </ScrollColumn>
        </View>
        <View style={[styles.fill, !landscape && !pageInFront && styles.behind]}>
          <ScrollColumn key={pageKey} style={styles.fill} contentContainerStyle={column}>
            {kind === 'tabletPortrait' && (
              <View style={styles.start}>
                <QuietButton label={back.label} onPress={back.onPress} testID={back.testID} />
              </View>
            )}
            {page}
          </ScrollColumn>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  bare: { padding: 0, gap: 0 },
  behind: { display: 'none' },
  start: { alignSelf: 'flex-start' },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.spaceLg },
  split: { flex: 1, minHeight: 0, flexDirection: 'row' },
});
