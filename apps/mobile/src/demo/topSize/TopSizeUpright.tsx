import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { Bell } from '../../components/BellButton.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { TABS, type Tab } from '../../components/TodayCover.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { CAPSULE_HEIGHT, CAPSULE_LABEL } from '../../layout/capsuleFit.ts';
import { nameStart } from '../../layout/pillFit.ts';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { useCurrentPlace } from '../OrgSwitcher.tsx';
import { SearchButton } from '../search/SearchHeader.tsx';
import { PILL_NAME, PILL_WAITING, uprightTile, uprightTop } from '../todaySize/todaySizeRules.ts';
import { TopPill } from './TopSizePill.tsx';
import { topUprightNameRoom, topUprightWaitingRoom } from './topSizeRules.ts';

/** sc-92728: the upright iPad's row above Settings at the stand-in size: the tabs take their size first, centred; the white pill beside them whole or its tile; Search and the bell at the end. From AX1 the tabs, Search and the bell keep to the top and the pill grows down. */
export function TopUprightRow({
  scale,
  waiting,
  at,
  onTab,
  tell,
}: {
  scale: number;
  waiting: number;
  at: Tab;
  onTab: (tab: Tab) => void;
  tell: Tell;
}) {
  const { t } = useTranslation();
  const name = useCurrentPlace()?.name ?? '';
  const labels = TABS.map(([, glyph]) => t(`todayScreen.tab.${glyph}`));
  const own = CAPSULE_LABEL * scale;
  const line = waiting > 0 ? t('invitations.count', { count: waiting }) : null;
  const start = nameStart(name);
  const [row, setRow] = useState(0);
  const [ends, setEnds] = useState(0);
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const keep = (key: string) => (width: number) =>
    setWidths((now) => (now[key] === width ? now : { ...now, [key]: width }));
  const tabWidths = labels.map((label) => widths[`tab|${own}|${label}`]);
  const nameWidth = widths[`name|${scale}|${start}`];
  const waitingWidth = line == null ? null : widths[`waiting|${scale}|${line}`];
  const known =
    row > 0 &&
    ends > 0 &&
    tabWidths.every((width) => width != null) &&
    nameWidth != null &&
    waitingWidth !== undefined;
  const top = uprightTop(
    scale,
    tabWidths.map((width) => width ?? 0),
    row,
    ends,
  );
  const tile = uprightTile(scale, top, {
    nameStart: nameWidth ?? 0,
    waitingLine: waitingWidth === null ? null : (waitingWidth ?? 0),
  });

  return (
    <View
      style={[styles.row, atAccessibilitySizes(scale) && styles.rowTop]}
      onLayout={(event: LayoutChangeEvent) => setRow(event.nativeEvent.layout.width)}
      testID="demo.topSize.uprightRow"
    >
      <MeasuredWords
        words={labels}
        size={own}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(label, width) => keep(`tab|${own}|${label}`)(width)}
      />
      <MeasuredWords
        words={[start]}
        size={PILL_NAME * scale}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(_, width) => keep(`name|${scale}|${start}`)(width)}
      />
      {line != null && (
        <MeasuredWords
          words={[line]}
          size={PILL_WAITING * scale}
          weight="semibold"
          allowFontScaling={false}
          onWidth={(_, width) => keep(`waiting|${scale}|${line}`)(width)}
        />
      )}
      <View style={styles.side}>
        {known && (
          <View style={[styles.pillAt, { maxWidth: top.pill }]}>
            <TopPill
              scale={scale}
              waiting={waiting}
              room={topUprightNameRoom(top.pill, scale)}
              waitingRoom={topUprightWaitingRoom(top.pill, scale)}
              tile={tile}
            />
          </View>
        )}
      </View>
      {known && <StandInCapsule labels={labels} size={top.labelSize} at={at} onTab={onTab} />}
      <View style={[styles.side, styles.end]}>
        <View
          style={styles.ends}
          onLayout={(event: LayoutChangeEvent) => setEnds(event.nativeEvent.layout.width)}
        >
          <SearchButton />
          <Bell unread={3} onPress={() => tell('Notifications have their own design.')} />
        </View>
      </View>
    </View>
  );
}

/** The product's white capsule, its four labels at the one size the row chose and the screen's tab chosen. */
function StandInCapsule({
  labels,
  size,
  at,
  onTab,
}: {
  labels: readonly string[];
  size: number;
  at: Tab;
  onTab: (tab: Tab) => void;
}) {
  return (
    <View style={styles.capsule} accessibilityRole="tablist">
      {TABS.map(([tab, glyph], index) => {
        const on = tab === at;
        const ink = on ? tokens.colorAccent : tokens.colorInkSecondary;
        const label = labels[index] ?? tab;

        return (
          <Pressable
            key={tab}
            onPress={() => onTab(tab)}
            hitSlop={tokens.spaceXxs}
            style={[styles.tab, on && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            testID={`demo.topSize.tab.${glyph}`}
          >
            <Glyph name={glyph} ink={ink} />
            <Text
              size={size}
              weight="semibold"
              numberOfLines={1}
              allowFontScaling={false}
              accessible={false}
              style={{ color: ink, lineHeight: Math.ceil(size * 1.2) }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: tokens.sizeHit },
  rowTop: { alignItems: 'flex-start' },
  side: { flex: 1, minWidth: 0, flexDirection: 'row' },
  end: { justifyContent: 'flex-end' },
  pillAt: { flexDirection: 'row', flexShrink: 1, minWidth: 0 },
  ends: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  capsule: {
    minHeight: CAPSULE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceHair,
    padding: tokens.spaceXxs,
    borderRadius: 23,
    backgroundColor: tokens.colorInset,
  },
  tab: {
    minHeight: CAPSULE_HEIGHT - 2 * tokens.spaceXxs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 13,
    paddingRight: tokens.spaceXl,
    borderRadius: 19,
  },
  tabOn: { backgroundColor: tokens.colorCard, ...tokens.elevationNative.raised.ios },
});
