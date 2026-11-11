import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { PHONE_TAB_BAR, TABS, type Tab } from '../../components/TodayCover.tsx';
import { wordsIn } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { TAB_GLYPH, TAB_GLYPH_GAP, TAB_HEIGHT, TAB_LABEL, tabLabelSize } from './textSizeRules.ts';

/** The phone's tab bar as proposed: one row of four, each label one size that keeps the widest word whole in its tab. */
export function TextSizeBar({
  scale,
  bottom,
  at,
  onTab,
  onSize,
}: {
  scale: number;
  bottom: number;
  at: Tab;
  onTab: (tab: Tab) => void;
  onSize: (size: number, slot: number) => void;
}) {
  const { t } = useTranslation();
  const labels = TABS.map(([, glyph]) => t(`todayScreen.tab.${glyph}`));
  const words = wordsIn(labels);
  const start = TAB_LABEL * scale;
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({});
  const [slot, setSlot] = useState(0);
  const widths = words.map((word) => measured[`${start}|${word}`]);
  const known = widths.every((width) => width != null);
  const size =
    slot > 0 && known ? tabLabelSize(scale, Math.max(...widths.map(Number)), slot) : TAB_LABEL;

  useEffect(() => {
    onSize(size, slot);
  }, [onSize, size, slot]);

  return (
    <View style={[styles.bar, { bottom }]} accessibilityRole="tablist">
      <View
        style={styles.measure}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[...new Set(words)].map((word) => (
          <Text
            key={word}
            size={start}
            weight="semibold"
            allowFontScaling={false}
            accessible={false}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setMeasured((current) => ({ ...current, [`${start}|${word}`]: width }));
            }}
          >
            {word}
          </Text>
        ))}
      </View>
      {TABS.map(([tab, glyph], index) => {
        const on = tab === at;
        const ink = on ? tokens.colorAccent : tokens.colorInkSecondary;

        return (
          <Pressable
            key={tab}
            onPress={() => onTab(tab)}
            onLayout={index === 0 ? (event) => setSlot(event.nativeEvent.layout.width) : undefined}
            style={[styles.tab, on && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={labels[index]}
            testID={`demo.textSize.tab.${glyph}`}
          >
            <Glyph name={glyph} size={TAB_GLYPH} ink={ink} />
            <Text
              size={size}
              weight={on ? 'semibold' : 'medium'}
              allowFontScaling={false}
              accessible={false}
              style={{ color: ink }}
            >
              {labels[index]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: PHONE_TAB_BAR,
    padding: 5,
    borderRadius: tokens.space5xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    flexDirection: 'row',
    gap: tokens.spaceHair,
    ...tokens.elevationNative.raised.ios,
    elevation: tokens.elevationNative.raised.android.elevation,
  },
  tab: {
    flex: 1,
    height: TAB_HEIGHT,
    borderRadius: TAB_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: TAB_GLYPH_GAP,
  },
  tabOn: { backgroundColor: tokens.colorAccentTint },
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 10000,
    alignItems: 'flex-start',
    opacity: 0,
  },
});
