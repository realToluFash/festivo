import { type ReactNode, type RefObject, useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type LayoutKind } from '../layout/classify.ts';
import { pillBesideTabs } from '../kit/frameBand.ts';
import { tokens } from '../theme/tokens.ts';
import { type TextHandle } from './Text.tsx';
import { Title } from './Title.tsx';
import { TOP_TITLE, topTitle } from './topTitle.ts';
import { TopPrimary, type TopPrimaryProps } from './TopPrimary.tsx';

/** Events', the Calendar's and Settings' top as their demos draw it (sc-39471): on a phone the pill and the bell on a row of their own, then the title at 34 with what ends its row; on its side the bell ends that row. */
export function ListTop({
  kind,
  title,
  titleRef,
  pill,
  bell,
  beside,
  primary,
  under,
  style,
  rowStyle,
}: {
  kind: LayoutKind;
  title: string;
  titleRef?: RefObject<TextHandle | null> | undefined;
  /** Drawn only on a phone; upright the pill stays in `PortraitTop`, and on its side it heads the sidebar. */
  pill: ReactNode;
  bell: ReactNode;
  beside?: ReactNode;
  primary?: TopPrimaryProps | undefined;
  under?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** The title's row, as Settings' column draws it shorter. */
  rowStyle?: StyleProp<ViewStyle>;
}) {
  const titleRow = (
    <View style={[styles.titleRow, rowStyle]}>
      <View style={styles.fill}>
        <Title size={TOP_TITLE} accessibilityRole="header" ref={titleRef} style={topTitle}>
          {title}
        </Title>
      </View>
      {beside}
      {primary != null && <TopPrimary {...primary} wide={kind !== 'phone'} />}
      {kind === 'tabletLandscape' && bell}
    </View>
  );

  return (
    <View style={style}>
      {kind === 'phone' && <PillRow pill={pill} bell={bell} />}
      {titleRow}
      {under}
    </View>
  );
}

/** A phone's row above the title: the pill, and the bell at its end. */
export function PillRow({ pill, bell }: { pill: ReactNode; bell: ReactNode }) {
  return (
    <View style={[styles.row, styles.pillRow]}>
      {pill != null && pill !== false && <View style={styles.shrink}>{pill}</View>}
      <View style={styles.fill} />
      {bell}
    </View>
  );
}

/** An iPad upright's row that stays: the pill, the tabs centred and the bell, 10 under the status bar; the pill turns to its tile when its words would not fit beside the tabs. */
export function PortraitTop({
  renderPill,
  bell,
  tabs,
}: {
  renderPill: (room: number | undefined) => ReactNode;
  bell: ReactNode;
  tabs: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [rowWidth, setRowWidth] = useState(0);
  const [tabsWidth, setTabsWidth] = useState(0);
  const besideTabs = pillBesideTabs(rowWidth, tabsWidth);
  const drawn = renderPill(besideTabs?.maxWidth);

  return (
    <View style={[styles.portraitTop, { paddingTop: insets.top + tokens.spaceMd }]}>
      <View style={styles.row} onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}>
        {drawn != null && drawn !== false && (
          <View style={[styles.shrink, besideTabs != null && { maxWidth: besideTabs.maxWidth }]}>
            {drawn}
          </View>
        )}
        <View style={styles.fill} />
        {bell}
        <View style={styles.tabsAt} pointerEvents="box-none">
          <View onLayout={(event) => setTabsWidth(event.nativeEvent.layout.width)}>{tabs}</View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shrink: { flexShrink: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  pillRow: { marginBottom: tokens.spaceSm },
  titleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  portraitTop: { paddingHorizontal: tokens.space3xl, paddingBottom: tokens.spaceXxs },
  tabsAt: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
