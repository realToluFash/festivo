import { PHONE_EVENT_TABS } from '@soirely/domain';
import { useCallback, useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AREA_GLYPH } from '../../components/areaGlyph.ts';
import { Text } from '../../components/Text.tsx';
import { TABS } from '../../components/TodayCover.tsx';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { NavBar } from '../DemoScreen.tsx';
import { NarrowBar, type NarrowTab } from './NarrowBar.tsx';
import {
  EVENT_BARS,
  LANGUAGES,
  SIZES,
  WIDTHS,
  barGeometry,
  scaleFor,
  widthFor,
  type NarrowEventBar,
  type NarrowLanguage,
  type NarrowSize,
  type NarrowWidth,
} from './narrowBarsRules.ts';

export interface NarrowBarsStart {
  width: NarrowWidth;
  size: NarrowSize;
  language: NarrowLanguage;
  eventBar: NarrowEventBar;
}

const OUTSIDER_TABS = ['overview', 'guests'] as const;

/** Today's bar and an event's bar on a phone the board chooses the width of, in the app's own words for each language (sc-99214). */
export function NarrowBarsScreen({ start }: { start: NarrowBarsStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [width, setWidth] = useState(start.width);
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [eventBar, setEventBar] = useState(start.eventBar);
  const [todayAt, setTodayAt] = useState('Today');
  const [eventAt, setEventAt] = useState('overview');
  const [today, setToday] = useState({ size: 0, slot: 0 });
  const [event, setEvent] = useState({ size: 0, slot: 0 });
  const onToday = useCallback((size: number, slot: number) => setToday({ size, slot }), []);
  const onEvent = useCallback((size: number, slot: number) => setEvent({ size, slot }), []);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const stage = widthFor(width, window.width);
  const scale = scaleFor(size, window.fontScale);
  const t = words.t.bind(words);
  const todayTabs: NarrowTab[] = TABS.map(([key, glyph]) => ({
    key,
    glyph,
    label: t(`todayScreen.tab.${glyph}`),
  }));
  const areas = eventBar === 'owner' ? PHONE_EVENT_TABS : OUTSIDER_TABS;
  const eventTabs: NarrowTab[] = [
    ...areas.map((area) => ({ key: area, glyph: AREA_GLYPH[area], label: t(`eventNav.${area}`) })),
    { key: 'more', glyph: 'dots', label: t('eventNav.more') },
  ];
  const { side } = barGeometry(stage);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <NavBar />
      <ScrollView horizontal contentContainerStyle={styles.stageRow}>
        <I18nextProvider i18n={words}>
          <View style={[styles.stage, { width: stage }]} testID="demo.narrowBars.stage">
            <Text size={tokens.typeSmall.size} weight="semibold" style={styles.caption}>
              {`Today, Events, Calendar, Settings · ${stage}dp wide · ${side} from each side`}
            </Text>
            <NarrowBar
              width={stage}
              scale={scale}
              tabs={todayTabs}
              rule="today"
              at={todayAt}
              onTab={setTodayAt}
              onSize={onToday}
              id="today"
            />
            <Text size={tokens.typeSmall.size} weight="semibold" style={styles.caption}>
              {`An event’s Overview · ${side} from each side`}
            </Text>
            <NarrowBar
              key={eventBar}
              width={stage}
              scale={scale}
              tabs={eventTabs}
              rule="event"
              at={eventAt}
              onTab={setEventAt}
              onSize={onEvent}
              id="event"
            />
          </View>
        </I18nextProvider>
      </ScrollView>
      <View style={styles.page}>
        <DemoOnly title="Stand in for the phone’s width, its Font size and qa’s account. Both bars are drawn on a phone the width chosen, at the size chosen; tapping a tab selects it. Nothing is sent and no string is added.">
          <Choices heading="Width" options={WIDTHS} chosen={width} onChoose={setWidth} id="width" />
          <Choices heading="Font size" options={SIZES} chosen={size} onChoose={setSize} id="size" />
          <Choices
            heading="Language"
            options={LANGUAGES}
            chosen={language}
            onChoose={setLanguage}
            id="language"
          />
          <Choices
            heading="An event’s bar"
            options={EVENT_BARS}
            chosen={eventBar}
            onChoose={(key) => {
              setEventBar(key);
              setEventAt('overview');
            }}
            id="eventBar"
          />
          <Text
            size={tokens.typeSmall.size}
            style={styles.secondary}
            testID="demo.narrowBars.drawn"
          >
            {`Today’s tabs are ${rounded(today.slot)} wide, labels at ${rounded(today.size)}. The event’s tabs are ${rounded(event.slot)} wide, labels at ${rounded(event.size)}.`}
          </Text>
        </DemoOnly>
      </View>
    </ScrollView>
  );
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function Choices<Key extends string>({
  heading,
  options,
  chosen,
  onChoose,
  id,
}: {
  heading: string;
  options: readonly { key: Key; label: string }[];
  chosen: Key;
  onChoose: (key: Key) => void;
  id: string;
}) {
  return (
    <View style={styles.choices}>
      <Text size={tokens.typeSmall.size} weight="semibold" style={styles.secondary}>
        {heading}
      </Text>
      <View style={styles.options}>
        {options.map((option) => {
          const on = option.key === chosen;

          return (
            <Pressable
              key={option.key}
              onPress={() => onChoose(option.key)}
              style={({ pressed }) => [
                styles.option,
                on && styles.optionOn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              testID={`demo.narrowBars.${id}.${option.key}`}
            >
              <Text size={tokens.typeSmall.size} weight="semibold">
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorCard },
  stageRow: { flexGrow: 1, justifyContent: 'center' },
  stage: {
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceLg,
    backgroundColor: tokens.colorPage,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: tokens.colorBorder,
  },
  caption: { color: tokens.colorInkSecondary, paddingHorizontal: tokens.spaceSm },
  page: { paddingHorizontal: tokens.spaceXxl, paddingTop: tokens.spaceLg },
  secondary: { color: tokens.colorInkSecondary },
  choices: { gap: tokens.spaceXs, width: '100%' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceXs },
  option: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkSecondary,
    backgroundColor: tokens.colorCard,
  },
  optionOn: { backgroundColor: tokens.colorAccentTint },
  pressed: { opacity: 0.7 },
});
