import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { PHONE_TAB_BAR } from '../../components/TodayCover.tsx';
import { tabLabelStart } from '../../layout/tabLabel.ts';
import { wordsIn } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { barGeometry, eventLabelSize, tabWidth, todayLabelSize } from './narrowBarsRules.ts';

export interface NarrowTab {
  key: string;
  glyph: GlyphName;
  label: string;
}

/** A phone's floating bar on a window `width` wide: under 360 it sits 8 from each side, 3 padding, no gap; its labels at one size by the bar's own rule. */
export function NarrowBar({
  width,
  scale,
  tabs,
  rule,
  at,
  onTab,
  onSize,
  id,
}: {
  width: number;
  scale: number;
  tabs: readonly NarrowTab[];
  rule: 'today' | 'event';
  at: string;
  onTab: (key: string) => void;
  onSize: (size: number, slot: number) => void;
  id: string;
}) {
  const geometry = barGeometry(width);
  const slot = tabWidth(width, tabs.length);
  const start = tabLabelStart(scale);
  const words = wordsIn(tabs.map((tab) => tab.label));
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({});
  const widths = words.map((word) => measured[`${start}|${word}`]);
  const widest = widths.every((one) => one != null) ? Math.max(...widths.map(Number)) : 0;
  const size =
    rule === 'today' ? todayLabelSize(scale, widest, slot) : eventLabelSize(scale, widest, slot);

  useEffect(() => {
    onSize(size, slot);
  }, [onSize, size, slot]);

  return (
    <View
      style={[
        styles.bar,
        {
          marginHorizontal: geometry.side,
          paddingHorizontal: geometry.padSides,
          paddingVertical: geometry.padEnds,
          gap: geometry.gap,
        },
      ]}
      accessibilityRole="tablist"
      testID={`demo.narrowBars.${id}`}
    >
      <MeasuredWords
        words={words}
        size={start}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(word, measuredWidth) => {
          setMeasured((now) => ({ ...now, [`${start}|${word}`]: measuredWidth }));
        }}
      />
      {tabs.map((tab) => {
        const on = tab.key === at;
        const ink = on ? tokens.colorAccent : tokens.colorInkSecondary;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onTab(tab.key)}
            style={[styles.tab, on && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.label}
            testID={`demo.narrowBars.${id}.${tab.key}`}
          >
            <Glyph name={tab.glyph} size={22} ink={ink} />
            <Text
              size={size}
              weight={on ? 'semibold' : 'medium'}
              allowFontScaling={false}
              accessible={false}
              style={[styles.label, { color: ink }]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: PHONE_TAB_BAR,
    borderRadius: tokens.space5xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    flexDirection: 'row',
    ...tokens.elevationNative.raised.ios,
    elevation: tokens.elevationNative.raised.android.elevation,
  },
  tab: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabOn: { backgroundColor: tokens.colorAccentTint },
  label: { textAlign: 'center' },
});
