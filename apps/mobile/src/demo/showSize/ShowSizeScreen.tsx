import { type Ref, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShowButton, type ShowChoice } from '../../components/CalendarControls.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { type Anchor, AnchoredMenu, anchorUnder } from '../../components/Summary.tsx';
import { openOnceSettled } from '../menuSettles.ts';
import { isTablet } from '../../layout/classify.ts';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { NavBar } from '../DemoScreen.tsx';
import { CW } from '../calendar/CalendarWords.ts';
import { LevelWords } from '../filterSize/FilterSizeScreen.tsx';
import {
  FILTER_LANGUAGES,
  FILTER_SIZES,
  type FilterLanguage,
  type FilterSize,
  filterScale,
} from '../filterSize/filterSizeRules.ts';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import { frameTitleCap } from '../frameTitleCap.ts';
import {
  SHOW_CHOSEN,
  SHOW_ROWS,
  type ShowChosen,
  type ShowRows,
  chosenIn,
} from './showSizeRules.ts';

export interface ShowSizeStart {
  size: FilterSize;
  language: FilterLanguage;
  rows: ShowRows;
  chosen: ShowChosen;
}

const MENU_AFTER_MS = 600;

/** sc-78219: the Calendar's Show menu at a stand-in text size, every word whole at the accessibility sizes. */
export function ShowSizeScreen({ start }: { start: ShowSizeStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const layout = useLayout();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [rows, setRows] = useState(start.rows);
  const [chosen, setChosen] = useState(start.chosen);
  const [menuAt, setMenuAt] = useState<Anchor | null>(null);
  const showRef = useRef<ViewInstance>(null);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const scale = filterScale(size, fontScale);
  const cap = frameTitleCap(isTablet(layout.kind), Math.min(layout.width, layout.height), scale);

  useEffect(() => {
    return openOnceSettled((then) => anchorUnder(showRef, then), setMenuAt, MENU_AFTER_MS);
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
      >
        <NavBar />
        <I18nextProvider i18n={words}>
          <Toolbar
            rows={rows}
            chosen={chosen}
            onChosen={setChosen}
            menuAt={menuAt}
            onMenuAt={setMenuAt}
            showRef={showRef}
            scale={scale}
            cap={cap}
          />
        </I18nextProvider>
        <View style={styles.page}>
          <DemoOnly title="Stand-ins for the device’s text size, its language, the rows the menu offers and the one chosen. The menu draws at the size chosen; Show stays as main draws it at this device’s size. At AX1 to AX5 each row grows up to the Calendar title’s size, wraps between its words beside the tick, and a word too wide for its line steps down until it fits whole, never under its default size. At the standard sizes the menu is main’s. Only what needs you is sc-32803’s row, in the demo’s English in both languages. Tap Show to open the menu again. Nothing is sent and no string is added.">
            <Choices
              heading="Text size"
              options={FILTER_SIZES}
              chosen={size}
              onChoose={setSize}
              id="size"
              prefix="demo.showSize"
            />
            <Choices
              heading="Language"
              options={FILTER_LANGUAGES}
              chosen={language}
              onChoose={setLanguage}
              id="language"
              prefix="demo.showSize"
            />
            <Choices
              heading="Rows"
              options={SHOW_ROWS}
              chosen={rows}
              onChoose={(key) => {
                setRows(key);
                setChosen((now) => chosenIn(key, now));
              }}
              id="rows"
              prefix="demo.showSize"
            />
            <Choices
              heading="Chosen"
              options={SHOW_CHOSEN.filter(({ key }) => chosenIn(rows, key) === key)}
              chosen={chosen}
              onChoose={setChosen}
              id="chosen"
              prefix="demo.showSize"
            />
          </DemoOnly>
        </View>
      </ScrollView>
    </View>
  );
}

function Toolbar({
  rows,
  chosen,
  onChosen,
  menuAt,
  onMenuAt,
  showRef,
  scale,
  cap,
}: {
  rows: ShowRows;
  chosen: ShowChosen;
  onChosen: (chosen: ShowChosen) => void;
  menuAt: Anchor | null;
  onMenuAt: (at: Anchor | null) => void;
  showRef: RefObject<ViewInstance | null>;
  scale: number;
  cap: number;
}) {
  const { t } = useTranslation();
  const choices = useMemo<ShowChoice<ShowChosen>[]>(
    () => [
      { value: 'all', word: t('calendar.showAll') },
      { value: 'events', word: t('calendar.showEvents') },
      ...(rows === 'needs' ? [{ value: 'needs' as const, word: CW.showNeedsYou }] : []),
    ],
    [t, rows],
  );

  return (
    <View style={styles.toolbar}>
      <ShowButton
        show={chosen}
        choices={choices}
        big={false}
        onPress={() => anchorUnder(showRef, onMenuAt)}
        ref={showRef}
      />
      <Menu
        at={menuAt}
        onClose={() => onMenuAt(null)}
        opener={showRef}
        chosen={chosen}
        choices={choices}
        onChosen={onChosen}
        scale={scale}
        cap={cap}
      />
    </View>
  );
}

/** Main's ShowMenu, its rows' words at the stand-in size. */
function Menu({
  at,
  onClose,
  opener,
  chosen,
  choices,
  onChosen,
  scale,
  cap,
}: {
  at: Anchor | null;
  onClose: () => void;
  opener: RefObject<ViewInstance | null>;
  chosen: ShowChosen;
  choices: readonly ShowChoice<ShowChosen>[];
  onChosen: (chosen: ShowChosen) => void;
  scale: number;
  cap: number;
}) {
  const first = useRef<ViewInstance>(null);

  return (
    <AnchoredMenu
      at={at}
      onClose={onClose}
      opener={opener}
      first={first}
      width={264}
      below={tokens.spaceSm}
      testID="demo.showSize.menu"
    >
      <View style={styles.menu}>
        {choices.map(({ value, word }, index) => (
          <Row
            key={value}
            ref={index === 0 ? first : undefined}
            word={word}
            on={value === chosen}
            onPress={() => {
              onChosen(value);
              onClose();
            }}
            testID={`demo.showSize.${value}`}
            scale={scale}
            cap={cap}
          />
        ))}
      </View>
    </AnchoredMenu>
  );
}

function Row({
  word,
  on,
  onPress,
  testID,
  scale,
  cap,
  ref,
}: {
  word: string;
  on: boolean;
  onPress: () => void;
  testID: string;
  scale: number;
  cap: number;
  ref?: Ref<ViewInstance> | undefined;
}) {
  const [room, setRoom] = useState(0);

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        atAccessibilitySizes(scale) && styles.choiceGrown,
        on && styles.choiceOn,
        pressed && !on && styles.choicePressed,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={word}
      testID={testID}
    >
      <View
        style={styles.words}
        onLayout={(event: LayoutChangeEvent) => setRoom(event.nativeEvent.layout.width)}
      >
        <LevelWords
          text={word}
          size={16}
          weight={on ? 'semibold' : 'medium'}
          room={room}
          style={on && styles.accent}
          scale={scale}
          cap={cap}
        />
      </View>
      <View style={styles.tick}>
        {on && <Glyph name="tick" size={18} ink={tokens.colorAccent} weight={2.6} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorPage },
  page: { paddingHorizontal: tokens.spaceXl, paddingTop: tokens.spaceLg, gap: tokens.spaceLg },
  toolbar: {
    paddingHorizontal: tokens.spaceXl,
    paddingTop: tokens.spaceLg,
    alignItems: 'flex-end',
  },
  menu: { gap: tokens.spaceHair, paddingHorizontal: tokens.spaceXs },
  choice: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spacePillEnd,
    borderRadius: tokens.spaceLg,
  },
  // From AX1 a wrapped row's tint keeps clear of its words; at the standard sizes the row is main's.
  choiceGrown: { paddingVertical: tokens.spaceXs },
  choiceOn: { backgroundColor: tokens.colorAccentTint },
  choicePressed: { backgroundColor: tokens.colorInset },
  words: { flex: 1, minWidth: 0 },
  accent: { color: tokens.colorAccentText },
  tick: { width: 18, alignItems: 'center' },
});
