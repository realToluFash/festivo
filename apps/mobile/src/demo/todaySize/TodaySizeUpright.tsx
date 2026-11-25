import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { Glass } from '../../components/Glass.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { BellButton, TABS, type Tab } from '../../components/TodayCover.tsx';
import { CAPSULE_LABEL } from '../../layout/capsuleFit.ts';
import { nameStart } from '../../layout/pillFit.ts';
import { atAccessibilitySizes, nameLines } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { useCurrentPlace } from '../OrgSwitcher.tsx';
import { SearchGlass } from '../SearchGlass.tsx';
import { Pill } from './TodaySizePill.tsx';
import { PILL_NAME, PILL_WAITING, uprightTile, uprightTop } from './todaySizeRules.ts';

/** sc-92314: the upright iPad's top row at the stand-in size: the tabs centred at the size they fit, the pill beside them whole or its tile, Search and the bell at the end; from AX1 every item keeps to the top and the pill grows down. */
export function UprightRow({
  scale,
  cap,
  waiting,
  onTab,
}: {
  scale: number;
  cap: number;
  waiting: number;
  onTab: (tab: Tab) => void;
}) {
  const { t } = useTranslation();
  const name = useCurrentPlace()?.name ?? '';
  const labels = TABS.map(([, glyph]) => t(`todayScreen.tab.${glyph}`));
  const own = CAPSULE_LABEL * scale;
  const line = waiting > 0 ? t('invitations.count', { count: waiting }) : null;
  const start = nameStart(name);
  const [row, setRow] = useState(0);
  const [widths, setWidths] = useState<Readonly<Record<string, number>>>({});
  const keep = (key: string) => (width: number) =>
    setWidths((now) => (now[key] === width ? now : { ...now, [key]: width }));
  const tabWidths = labels.map((label) => widths[`tab|${own}|${label}`]);
  const nameWidth = widths[`name|${scale}|${start}`];
  const waitingWidth = line == null ? null : widths[`waiting|${scale}|${line}`];
  const known =
    row > 0 &&
    tabWidths.every((width) => width != null) &&
    nameWidth != null &&
    waitingWidth !== undefined;
  const top = uprightTop(
    scale,
    tabWidths.map((width) => width ?? 0),
    row,
  );
  const large = atAccessibilitySizes(scale);
  const tile = uprightTile(scale, top, {
    nameStart: nameWidth ?? 0,
    waitingLine: waitingWidth === null ? null : (waitingWidth ?? 0),
  });

  return (
    <View
      style={[styles.row, large && styles.rowTop]}
      onLayout={(event: LayoutChangeEvent) => setRow(event.nativeEvent.layout.width)}
      testID="demo.todaySize.uprightRow"
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
            <Pill
              scale={scale}
              cap={cap}
              waiting={waiting}
              room={top.nameRoom}
              waitingRoom={top.waitingRoom}
              tile={tile}
              lines={large ? undefined : nameLines(scale)}
            />
          </View>
        )}
      </View>
      {known && <StandInCapsule labels={labels} size={top.labelSize} onTab={onTab} />}
      <View style={[styles.side, styles.end]}>
        <View style={styles.ends}>
          <SearchGlass />
          <BellButton />
        </View>
      </View>
    </View>
  );
}

/** iPadOS 26's tab bar in glass, its four labels at the one size the row chose, Today chosen. */
function StandInCapsule({
  labels,
  size,
  onTab,
}: {
  labels: readonly string[];
  size: number;
  onTab: (tab: Tab) => void;
}) {
  return (
    <Glass height={46} grows style={styles.capsule}>
      {TABS.map(([tab, glyph], index) => {
        const on = tab === 'Today';
        const ink = on ? tokens.colorAccent : tokens.colorInkOnDark;
        const label = labels[index] ?? tab;

        return (
          <Pressable
            key={tab}
            onPress={() => onTab(tab)}
            style={[styles.tab, on && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            testID={`demo.todaySize.tab.${glyph}`}
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
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: tokens.space3xl - tokens.spaceXxl,
  },
  rowTop: { alignItems: 'flex-start' },
  side: { flex: 1, minWidth: 0, flexDirection: 'row' },
  end: { justifyContent: 'flex-end' },
  pillAt: { flexDirection: 'row', flexShrink: 1, minWidth: 0 },
  ends: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  capsule: {
    paddingHorizontal: tokens.spaceXxs,
    paddingVertical: tokens.spaceXxs,
    gap: tokens.spaceHair,
  },
  tab: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 13,
    paddingRight: tokens.spaceXl,
    borderRadius: 19,
  },
  tabOn: { backgroundColor: tokens.colorCard },
});
