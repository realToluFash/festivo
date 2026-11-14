import { roleName } from '@soirely/domain';
import { useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { OrgPill } from '../../components/OrgPill.tsx';
import { RoundButton, TYPE } from '../../components/SettingsParts.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { type Tab, TABS } from '../../components/TodayCover.tsx';
import { pillBesideTabs } from '../../kit/frameBand.ts';
import { nameStart, pillShowsWords } from '../../layout/pillFit.ts';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { NavBar } from '../DemoScreen.tsx';
import {
  CAPSULE_LABEL,
  capsuleLabelSize,
  capsuleRoom,
  capsuleWidth,
  LANGUAGES,
  pillGivesWay,
  scaleFor,
  SIZES,
  type TabletTabsLanguage,
  type TabletTabsSize,
} from './tabletTabsRules.ts';

export interface TabletTabsStart {
  size: TabletTabsSize;
  language: TabletTabsLanguage;
  waiting: boolean;
  at: Tab;
}

const ORGANISATION = 'QA Organisation';

/** sc-40401: the upright tablet's row at a text size the board chooses, the four labels one size that keeps the capsule clear of the tile and the bell. */
export function TabletTabsScreen({ start }: { start: TabletTabsStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [waiting, setWaiting] = useState(start.waiting);
  const [at, setAt] = useState<Tab>(start.at);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const scale = scaleFor(size, fontScale);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
      >
        <NavBar />
        <I18nextProvider i18n={words}>
          <Row scale={scale} waiting={waiting} at={at} onTab={setAt} />
        </I18nextProvider>
        <View style={styles.page}>
          <DemoOnly title="Stand in for the tablet’s Font size and language and qa’s account. The tabs are drawn at the size chosen; the pill’s words, where it shows them, at this device’s own size. No string is added, and nothing is sent.">
            <Choices
              heading="Text size"
              options={SIZES}
              chosen={size}
              onChoose={setSize}
              id="size"
            />
            <Choices
              heading="Language"
              options={LANGUAGES}
              chosen={language}
              onChoose={setLanguage}
              id="language"
            />
            <Choices
              heading="Invitations"
              options={[
                { key: 'one', label: '1 waiting' },
                { key: 'none', label: 'None' },
              ]}
              chosen={waiting ? 'one' : 'none'}
              onChoose={(key) => setWaiting(key === 'one')}
              id="waiting"
            />
          </DemoOnly>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({
  scale,
  waiting,
  at,
  onTab,
}: {
  scale: number;
  waiting: boolean;
  at: Tab;
  onTab: (tab: Tab) => void;
}) {
  const { t } = useTranslation();
  const labels = TABS.map(([, glyph]) => t(`todayScreen.tab.${glyph}`));
  const start = CAPSULE_LABEL * scale;
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({});
  const [pillWords, setPillWords] = useState<Readonly<Record<string, number>>>({});
  const [rowWidth, setRowWidth] = useState(0);
  const [opened, setOpened] = useState<string | null>(null);
  const widths = labels.map((label) => measured[`${start}|${label}`]);
  const total = widths.every((width) => width != null)
    ? widths.reduce((a, b) => a + Number(b), 0)
    : 0;
  const room = rowWidth > 0 ? capsuleRoom(rowWidth) : 0;
  const labelSize = capsuleLabelSize(scale, total, room);
  const capsule = capsuleWidth(total, start, labelSize);
  const beside = pillBesideTabs(rowWidth, capsule);
  const waitingWords = waiting ? t('invitations.count', { count: 1 }) : null;
  const role = roleName(t, { seededAs: 'owner', name: null });
  const largest = atAccessibilitySizes(scale);
  const tileAlone =
    pillGivesWay(scale, labelSize) ||
    !pillShowsWords(
      beside?.maxWidth ?? 0,
      {
        nameStart: pillWords.nameStart ?? 0,
        waitingLine: waitingWords == null ? null : (pillWords.waiting ?? 0),
      },
      largest,
    );

  return (
    <View style={styles.header}>
      <MeasuredWords
        words={labels}
        size={start}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(label, width) =>
          setMeasured((was) =>
            was[`${start}|${label}`] === width ? was : { ...was, [`${start}|${label}`]: width },
          )
        }
      />
      <PillWords
        name={ORGANISATION}
        waiting={waitingWords}
        onMeasure={(key, width) =>
          setPillWords((was) => (was[key] === width ? was : { ...was, [key]: width }))
        }
      />
      <View style={styles.row} onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}>
        <View style={[styles.shrink, beside != null && { maxWidth: beside.maxWidth }]}>
          <OrgPill
            id="org-qa"
            name={ORGANISATION}
            waiting={waitingWords}
            label={
              waiting
                ? t('switcher.labelSwitchWaiting', { name: ORGANISATION, role, count: 1 })
                : t('switcher.labelSwitch', { name: ORGANISATION, role })
            }
            onPress={() => setOpened(t('switcher.asks'))}
            bare={largest && !tileAlone}
            wrap={largest && !tileAlone}
            lines={largest ? 2 : 1}
            tileAlone={tileAlone}
            testID="demo.tabletTabs.pill"
          />
        </View>
        <View style={styles.fill} />
        <RoundButton
          glyph="bell"
          label={t('notifications.bell')}
          onPress={() => setOpened(t('notifications.heading'))}
          testID="demo.tabletTabs.bell"
        />
        <View style={styles.capsuleAt} pointerEvents="box-none">
          <Capsule
            labels={labels}
            size={labelSize}
            at={at}
            onTab={(tab, label) => {
              onTab(tab);
              setOpened(label);
            }}
          />
        </View>
      </View>
      <Text size={TYPE.meta} style={styles.secondary} testID="demo.tabletTabs.drawn">
        {`Row ${Math.round(rowWidth)} wide on this device, ${Math.round(room)} for the capsule. Labels at ${labelSize} (own size ${Math.round(start * 10) / 10}), capsule ${Math.round(capsule)} wide. The pill is ${tileAlone ? 'its tile' : 'its words'}.${opened == null ? '' : ` Last tap opens ${opened}.`}`}
      </Text>
    </View>
  );
}

/** `WhiteCapsule` with its four labels at one size the row chooses, drawn at that size whatever the device's own. */
function Capsule({
  labels,
  size,
  at,
  onTab,
}: {
  labels: readonly string[];
  size: number;
  at: Tab;
  onTab: (tab: Tab, label: string) => void;
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
            onPress={() => onTab(tab, label)}
            hitSlop={tokens.spaceXxs}
            style={[styles.tab, on && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            testID={`demo.tabletTabs.tab.${glyph}`}
          >
            <Glyph name={glyph} ink={ink} />
            <Text
              size={size}
              weight="semibold"
              numberOfLines={1}
              allowFontScaling={false}
              accessible={false}
              style={{ color: ink }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The pill's name start and invitation line, measured out of sight at the pill's sizes. */
function PillWords({
  name,
  waiting,
  onMeasure,
}: {
  name: string;
  waiting: string | null;
  onMeasure: (key: string, width: number) => void;
}) {
  const items: readonly (readonly [string, string, number])[] = [
    ['nameStart', nameStart(name), 15],
    ['waiting', waiting ?? '', 12.5],
  ];

  return (
    <View
      style={styles.measure}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {items.map(([key, words, size]) => (
        <Text
          key={key}
          size={size}
          weight="semibold"
          numberOfLines={1}
          accessible={false}
          style={styles.measured}
          onLayout={(event) => onMeasure(key, Math.ceil(event.nativeEvent.layout.width))}
        >
          {words}
        </Text>
      ))}
    </View>
  );
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
              testID={`demo.tabletTabs.${id}.${option.key}`}
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
  screen: { flex: 1, backgroundColor: tokens.colorPage },
  page: { gap: tokens.spaceMd, paddingHorizontal: tokens.spaceXxl, paddingTop: tokens.spaceLg },
  header: {
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.space4xl,
    paddingBottom: tokens.spaceXl,
    backgroundColor: tokens.colorHeader,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorHeaderBorder,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  shrink: { flexShrink: 1, minWidth: 0 },
  fill: { flex: 1 },
  capsuleAt: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsule: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceHair,
    paddingHorizontal: tokens.spaceXxs,
    borderRadius: 23,
    backgroundColor: tokens.colorInset,
  },
  tab: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: 13,
    paddingRight: tokens.spaceXl,
    borderRadius: 19,
  },
  tabOn: { backgroundColor: tokens.colorCard, ...tokens.elevationNative.raised.ios },
  secondary: { color: tokens.colorInkSecondary },
  measure: { position: 'absolute', top: 0, left: 0, width: 4000, opacity: 0 },
  measured: { alignSelf: 'flex-start' },
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
