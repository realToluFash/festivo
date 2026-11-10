import { useCallback, useEffect, useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../components/Text.tsx';
import { PHONE_TAB_BAR, TabBarFade, tabBarFoot, type Tab } from '../../components/TodayCover.tsx';
import { tokens } from '../../theme/tokens.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { NavBar } from '../DemoScreen.tsx';
import { BoldTextSwitch } from '../boldText/BoldTextSwitch.tsx';
import { closeBoldTextBoard, openBoldTextBoard } from '../boldText/boldTextStore.ts';
import { YOU } from '../settings/sample.ts';
import { TextSizeBar } from './TextSizeBar.tsx';
import { TextSizeCard } from './TextSizeCard.tsx';
import {
  LANGUAGES,
  LONG_EMAIL,
  LONG_ORGANISATION,
  QA_ORGANISATION,
  scaleFor,
  TEXT_SIZES,
  type TextSizeChoice,
  type TextSizeLanguage,
} from './textSizeRules.ts';

export interface TextSizeStart {
  size: TextSizeChoice;
  language: TextSizeLanguage;
  longOrganisation: boolean;
  longEmail: boolean;
  bold: boolean;
  at: Tab;
}

/** The Settings card and the phone's tab bar at a text size the board chooses, in the app's own words for each language. */
export function TextSizeScreen({ start }: { start: TextSizeStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [longOrganisation, setLongOrganisation] = useState(start.longOrganisation);
  const [longEmail, setLongEmail] = useState(start.longEmail);
  const [at, setAt] = useState<Tab>(start.at);
  const [drawn, setDrawn] = useState({ size: 0, slot: 0 });
  const onSize = useCallback((size: number, slot: number) => setDrawn({ size, slot }), []);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const scale = scaleFor(size, fontScale);
  const foot = tabBarFoot(insets.bottom);

  useEffect(() => {
    openBoldTextBoard(start.bold);

    return closeBoldTextBoard;
  }, [start.bold]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: foot + PHONE_TAB_BAR + tokens.spaceMd,
        }}
      >
        <NavBar />
        <View style={styles.page}>
          <I18nextProvider i18n={words}>
            <TextSizeCard
              scale={scale}
              name={YOU.name}
              initials={YOU.initials}
              email={longEmail ? LONG_EMAIL : YOU.email}
              organisation={longOrganisation ? LONG_ORGANISATION : QA_ORGANISATION}
            />
          </I18nextProvider>
          <DemoOnly title="Stand in for the phone’s own settings and qa’s account. The card and the bar are drawn at the size chosen; no string is added.">
            <Choices
              heading="Text size"
              options={TEXT_SIZES}
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
              heading="Organisation"
              options={[
                { key: 'qa', label: QA_ORGANISATION },
                { key: 'long', label: '100 characters' },
              ]}
              chosen={longOrganisation ? 'long' : 'qa'}
              onChoose={(key) => setLongOrganisation(key === 'long')}
              id="organisation"
            />
            <Choices
              heading="Email"
              options={[
                { key: 'short', label: YOU.email },
                { key: 'long', label: 'Wider than its line' },
              ]}
              chosen={longEmail ? 'long' : 'short'}
              onChoose={(key) => setLongEmail(key === 'long')}
              id="email"
            />
            <BoldTextSwitch />
            <Text
              size={tokens.typeSmall.size}
              style={styles.secondary}
              testID="demo.textSize.drawn"
            >
              {`On this phone each tab is ${Math.round(drawn.slot * 10) / 10} wide, so the labels are at ${drawn.size}. The boards' sizes are for a 360-wide Android phone and the 402-wide iPhone.`}
            </Text>
          </DemoOnly>
        </View>
      </ScrollView>
      <TabBarFade />
      <I18nextProvider i18n={words}>
        <TextSizeBar scale={scale} bottom={foot} at={at} onTab={setAt} onSize={onSize} />
      </I18nextProvider>
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
              testID={`demo.textSize.${id}.${option.key}`}
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
