import { type ReactNode, type RefObject, useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type LayoutKind } from '../layout/classify.ts';
import { pillBesideTabs } from '../kit/frameBand.ts';
import {
  type CapsuleMeasures,
  capsuleGrowth,
  measuredAt,
  withMeasure,
} from '../layout/capsuleFit.ts';
import { tokens } from '../theme/tokens.ts';
import { type TextHandle } from './Text.tsx';
import { useCapsuleLabels } from './CapsuleLabels.tsx';
import { Title } from './Title.tsx';
import { TOP_TITLE, topTitle } from './topTitle.ts';
import { TopPrimary, type TopPrimaryProps, usePrimaryLabel } from './TopPrimary.tsx';

/** Events', the Calendar's and Settings' top as their demos draw it (sc-39471): on a phone the pill and the bell on a row of their own, then the title at 34 with what ends its row; on its side the bell ends that row. */
export function ListTop({
  kind,
  title,
  titleRef,
  onTitleDrawn,
  pill,
  bell,
  beside,
  bellUnder = false,
  primary,
  under,
  untitled = false,
  style,
  rowStyle,
}: {
  kind: LayoutKind;
  title: string;
  titleRef?: RefObject<TextHandle | null> | undefined;
  onTitleDrawn?: ((size: number) => void) | undefined;
  /** Drawn only on a phone; upright the pill stays in `PortraitTop`, and on its side it heads the sidebar. */
  pill: ReactNode;
  bell: ReactNode;
  beside?: ReactNode;
  /** On its side, the bell under the title and `under` rather than at the end of the title's row (sc-79265). */
  bellUnder?: boolean;
  primary?: TopPrimaryProps | undefined;
  under?: ReactNode;
  /** The page in front names itself, so the top draws no title (sc-37693). */
  untitled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** The title's row, as Settings' column draws it shorter. */
  rowStyle?: StyleProp<ViewStyle>;
}) {
  const label = usePrimaryLabel({
    title,
    size: TOP_TITLE,
    style: topTitle,
    label: primary?.label,
    gap: tokens.spaceMd,
    labelled: kind !== 'phone',
  });
  const titleRow = (
    <View style={[styles.titleRow, rowStyle]}>
      <View style={styles.fill} onLayout={label.onSlot}>
        {label.measure}
        <Title
          size={TOP_TITLE}
          accessibilityRole="header"
          ref={titleRef}
          style={topTitle}
          onDrawn={onTitleDrawn}
        >
          {title}
        </Title>
      </View>
      {beside}
      {primary != null && <TopPrimary {...primary} wide={label.wide} />}
      {kind === 'tabletLandscape' && !bellUnder && bell}
    </View>
  );

  return (
    <View style={style}>
      {kind === 'phone' && <PillRow pill={pill} bell={bell} />}
      {!untitled && titleRow}
      {under}
      {kind === 'tabletLandscape' && bellUnder && <View style={styles.bellUnder}>{bell}</View>}
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

/** An iPad upright's row that stays, 10 under the status bar, with its tabs 7 under it. */
export function PortraitTop(props: PortraitRowProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.portraitTop, { paddingTop: insets.top + tokens.spaceMd }]}>
      <PortraitRow {...props} />
    </View>
  );
}

type PortraitRowProps = {
  /** The pill, given the room beside the tabs and whether the tabs need it, when it must be its tile. */
  renderPill: (room: number | undefined, tileAlone: boolean) => ReactNode;
  bell: ReactNode;
  /** The labels the tabs draw, measured to choose their one size. */
  tabLabels: readonly string[];
  renderTabs: (labelSize: number) => ReactNode;
  /** Centres the tabs in the row, where a screen out of an event has always had them. */
  tabsCentred?: boolean;
};

/** The pill, the bell, and the tabs centred 3 above the row's top whatever the pill's height; a capsule its labels make taller makes the row as much taller, so the pill and the bell stay on its middle and the page starts under it (sc-37693). The tabs' labels take the largest size at which they clear the tile and the end, Search and the bell as wide as they are drawn (sc-91290), and while that is under their own size the pill is its tile (sc-40401); otherwise the pill turns to its tile when its words would not fit beside the tabs. */
export function PortraitRow({
  renderPill,
  bell,
  tabLabels,
  renderTabs,
  tabsCentred = false,
}: PortraitRowProps) {
  const [rowWidth, setRowWidth] = useState(0);
  const [endWidth, setEndWidth] = useState<number>();
  const { labelSize, givesWay, measure } = useCapsuleLabels(tabLabels, rowWidth, endWidth);
  const [measures, setMeasures] = useState<CapsuleMeasures>({});
  const { width: tabsWidth, height: tabsHeight } = measuredAt(measures, labelSize);
  const besideTabs = pillBesideTabs(rowWidth, tabsWidth);
  const drawn = renderPill(besideTabs?.maxWidth, givesWay);

  return (
    <View
      style={[styles.row, { minHeight: tokens.sizeHit + capsuleGrowth(tabsHeight) }]}
      onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
    >
      {measure}
      {drawn != null && drawn !== false && (
        <View style={[styles.shrink, besideTabs != null && { maxWidth: besideTabs.maxWidth }]}>
          {drawn}
        </View>
      )}
      <View style={styles.fill} />
      <View onLayout={(event) => setEndWidth(event.nativeEvent.layout.width)}>{bell}</View>
      <View style={tabsCentred ? styles.tabsCentred : styles.tabsAt} pointerEvents="box-none">
        <View
          key={labelSize}
          onLayout={(event) => {
            if (labelSize == null) return;
            const { width, height } = event.nativeEvent.layout;
            setMeasures((prev) => withMeasure(prev, labelSize, { width, height }));
          }}
        >
          {labelSize != null && renderTabs(labelSize)}
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
  bellUnder: { alignSelf: 'flex-start', marginTop: tokens.spaceXs },
  titleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  portraitTop: { paddingHorizontal: tokens.space3xl, paddingBottom: tokens.spaceXxs },
  tabsAt: {
    position: 'absolute',
    top: 7 - tokens.spaceMd,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tabsCentred: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
