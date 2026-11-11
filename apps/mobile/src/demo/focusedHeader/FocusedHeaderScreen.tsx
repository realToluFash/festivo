import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { useShellLayout } from '../../components/settingsShell.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { W as BUDGET } from '../budget/BudgetWords.ts';
import { YOU } from '../settings/sample.ts';
import { DemoBack, DemoFocusNav, type NavSide } from './FocusedHeaderNav.tsx';
import {
  HEADER_LANGUAGES,
  HEADER_SCREENS,
  HEADER_SIZES,
  scaleFor,
  type HeaderLanguage,
  type HeaderScreen,
  type HeaderSize,
} from './focusedHeaderRules.ts';

export interface FocusedHeaderStart {
  size: HeaderSize;
  language: HeaderLanguage;
  screen: HeaderScreen;
}

const SHEET = 540;
const SHEET_SIDE = tokens.spaceXxl;
const PAGE_SIDE = tokens.spaceXxl;
const TABLET_PAGE_SIDE = tokens.space5xl;

/** A focused screen's header and the Back pill at a text size and language the board chooses, in the app's own words. */
export function FocusedHeaderScreen({ start }: { start: FocusedHeaderStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const tablet = useShellLayout() !== 'phone';
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [screen, setScreen] = useState(start.screen);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const t = words.t.bind(words);
  const scale = scaleFor(size, fontScale);
  const navWidth = tablet ? Math.min(SHEET, windowWidth - 2 * SHEET_SIDE) - 2 : windowWidth;
  const close = (testID: string, word: string): NavSide => ({
    word,
    heard: word,
    onPress: goBack,
    testID,
  });
  const cancel = close('demo.header.cancel', t('frame.cancel'));
  const save = close('demo.header.save', t('account.save'));

  const choosers = (
    <DemoOnly title="Stand-ins for the phone’s own text size and language. The header and the pill are drawn at the size chosen; the page under them is the app’s own, at this phone’s size. Cancel, Close, Save and the pill each go back with one tap. No string is added.">
      <Choices
        heading="Text size"
        options={HEADER_SIZES}
        chosen={size}
        onChoose={setSize}
        id="size"
      />
      <Choices
        heading="Language"
        options={HEADER_LANGUAGES}
        chosen={language}
        onChoose={setLanguage}
        id="language"
      />
      <Choices
        heading="Screen"
        options={HEADER_SCREENS}
        chosen={screen}
        onChoose={setScreen}
        id="screen"
      />
    </DemoOnly>
  );

  if (screen === 'back') {
    const side = tablet ? TABLET_PAGE_SIDE : PAGE_SIDE;
    const settings = t('settings.title');
    const events = t('todayScreen.tab.events');

    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={{
          paddingTop: insets.top + tokens.spaceXxs,
          paddingBottom: insets.bottom + tokens.space5xl,
          paddingHorizontal: side,
          gap: tokens.space3xl,
        }}
      >
        {!tablet && (
          <View style={styles.place}>
            <DemoBack
              scale={scale}
              word={settings}
              heard={t('frame.backTo', { place: settings })}
              room={windowWidth - 2 * side}
              onPress={goBack}
              testID="demo.header.back.settings"
            />
            <Text
              size={scale > 1 ? 43 : 34}
              weight="bold"
              allowFontScaling={false}
              accessibilityRole="header"
            >
              {t('settings.account')}
            </Text>
          </View>
        )}
        <View style={styles.top}>
          <DemoBack
            scale={scale}
            word={events}
            heard={t('frame.backTo', { place: events })}
            room={windowWidth - 2 * side - tokens.sizeHit}
            onPress={goBack}
            testID="demo.header.back.events"
          />
          <View style={styles.grow} />
          <View
            style={styles.bell}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Glyph name="bell" size={19} ink={tokens.colorInk} />
          </View>
        </View>
        {choosers}
      </ScrollView>
    );
  }

  const header =
    screen === 'due-now' ? (
      <DemoFocusNav
        scale={scale}
        width={navWidth}
        title={BUDGET.dueNow}
        left={null}
        verb={close('demo.header.close', BUDGET.close)}
      />
    ) : (
      <DemoFocusNav
        scale={scale}
        width={navWidth}
        title={t(TITLES[screen])}
        left={cancel}
        verb={save}
      />
    );

  return (
    <View style={[styles.fill, tablet ? styles.dimmed : styles.page, { paddingTop: insets.top }]}>
      <View style={tablet ? [styles.sheet, { width: navWidth + 2 }] : styles.fill}>
        {header}
        <ScrollView
          style={tablet ? styles.sheetBody : styles.fill}
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + tokens.space5xl }]}
        >
          {screen === 'timezone' && (
            <Text size={tokens.typeBody.size} style={styles.secondary}>
              {t('timeZone.intro')}
            </Text>
          )}
          {screen !== 'due-now' && (
            <View style={styles.field}>
              <Text size={tokens.typeSmall.size} weight="semibold" style={styles.secondary}>
                {t(FIELDS[screen])}
              </Text>
              <View style={styles.input}>
                <Text size={tokens.typeBody.size}>{screen === 'name' ? YOU.name : ' '}</Text>
              </View>
            </View>
          )}
          {screen === 'due-now' && (
            <Text size={tokens.typeBody.size} style={styles.secondary}>
              {BUDGET.dueNow}
            </Text>
          )}
          {choosers}
        </ScrollView>
      </View>
    </View>
  );
}

const TITLES = {
  name: 'nameCard.title',
  password: 'passwordCard.change',
  timezone: 'timeZone.title',
} as const;

const FIELDS = {
  name: 'account.fullName',
  password: 'passwordCard.current',
  timezone: 'timeZone.find',
} as const;

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
              testID={`demo.header.${id}.${option.key}`}
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
  fill: { flex: 1 },
  grow: { flex: 1 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  dimmed: { alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.scrimDialog },
  sheet: {
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
  },
  sheetBody: { flexGrow: 0 },
  body: { paddingTop: tokens.spaceXl, paddingHorizontal: tokens.spaceXxl, gap: tokens.spaceLg },
  secondary: { color: tokens.colorInkSecondary },
  field: { gap: tokens.spaceXs },
  input: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorInkSecondary,
    borderRadius: tokens.spaceLg,
  },
  place: { gap: tokens.spaceLg },
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  bell: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
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
  pressed: { opacity: tokens.opacityPressed },
});
