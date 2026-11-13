import { type RefObject, useEffect, useId, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { currentLocale } from '../i18n/index.ts';
import { FIELD_DEFAULTS, fieldName, refusedHint, withInvalid } from '../kit/fields.ts';
import { searchBesideTitle } from '../kit/keyboard.ts';
import { TURNS_WITH_THE_APP } from '../layout/orientations.ts';
import { useLayout } from '../layout/useLayout.ts';
import { useBoldText } from '../theme/boldText.ts';
import { inputFaced } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { useModalOpen } from '../updateRequired.ts';
import { FocusEdge, focusEdge, useFocusEdge, useHeld, useRefused } from './Field.tsx';
import { controlTaken } from './focusedField.ts';
import { useScreenReaderOn } from './screenReaderFocus.ts';
import { LIFT } from './keyboardWatch.ts';
import { SETTLED_MS, Screen, useFocusOnAnswer } from './Screen.tsx';
import { SilentWindowName, WINDOW_ARRIVES_MS, useUnnamedWindow } from './Sheet.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { UnseenName } from './UnseenName.tsx';
import { useSystemBack } from './useSystemBack.ts';

const CONTROL_TEXT_SIZE = 16;

export interface Choice {
  code: string;
  name: string;
}

/** A select, as the artboard draws one: the chosen value in a field, and the whole list one tap away. */
export function ListPicker({
  label,
  placeholder = label,
  searchLabel,
  choices,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  shown: drawn,
  wrong = false,
  line,
  pickerRef,
  testID,
}: {
  label: string;
  placeholder?: string;
  searchLabel: string;
  choices: readonly Choice[];
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  /** Drawn and announced as a field that can't change, not as one that is only busy. */
  readOnly?: boolean;
  /** Drawn in place of the chosen name, as a phone's "🇬🇧 +44" is; the screen reader still hears the name. */
  shown?: string | undefined;
  /** A line about it shows under it: a refused text field's red edge, 2pt with focus (sc-30447). */
  wrong?: boolean;
  /** The line about it, where it sits in no Field whose line that is, as a phone's code beside its number does. */
  line?: string | null | undefined;
  /** For moving screen-reader focus here when it is the field refused first. */
  pickerRef?: RefObject<ViewInstance | null> | undefined;
  testID: string;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [open, setOpen] = useState(false);
  const pickerShown = useModalOpen(open);
  const reduced = useReducedMotion();
  const { windowUp, rise, risen } = usePickerRise(pickerShown, reduced);
  const windowShown = useModalOpen(open || windowUp);
  const onScreen = windowUp && pickerShown;
  const unnamed = useUnnamedWindow(
    Platform.OS === 'android' && pickerShown,
    onScreen,
    null,
    reduced ? 0 : WINDOW_ARRIVES_MS,
  );
  const readerOn = useScreenReaderOn();
  const listFilling = useListFilling(
    Platform.OS === 'android' && readerOn,
    windowShown,
    onScreen && !unnamed,
  );
  const heading = useRef<TextHandle>(null);
  const ownField = useRef<ViewInstance>(null);
  const field = pickerRef ?? ownField;
  const [closedEarly, setClosedEarly] = useState<object>();
  const [search, setSearch] = useState('');
  const searchNameID = useId();
  const searching = useHeld(false, search, undefined, setSearch);
  const searchEdge = useFocusEdge();
  const bold = useBoldText();
  const fieldEdge = useFocusEdge(controlTaken);
  const refused = useRefused(wrong, line);
  const { kind, width, height } = useLayout();
  const slide = rise.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
  const beside = searchBesideTitle({ phone: kind === 'phone', width, height });

  // TalkBack otherwise puts its focus on Done, past the title (sc-42690).
  useFocusOnAnswer(
    Platform.OS === 'android' && onScreen && !unnamed ? true : undefined,
    heading,
    0,
  );

  // Until the menu's window takes Back, Android gives it to the screen beneath, which stepped back or asked to leave (sc-43145).
  useSystemBack(open, () => {
    setClosedEarly({});
    setOpen(false);
  });
  useFocusOnAnswer(windowShown ? undefined : closedEarly, field);

  const chosen = choices.find((choice) => choice.code === value)?.name ?? value;
  const blank = chosen === '';
  const name = blank ? label : `${label}: ${chosen}`;
  const needle = search.trim().toLocaleLowerCase(locale);
  const shown =
    needle === ''
      ? choices
      : choices.filter((choice) => choice.name.toLocaleLowerCase(locale).includes(needle));

  const searchField = (
    <View style={beside ? styles.searchBeside : undefined}>
      {/* TalkBack reads no placeholder once the search holds text, so these words name it then. */}
      <UnseenName nativeID={searchNameID}>{searchLabel}</UnseenName>
      <TextInput
        {...FIELD_DEFAULTS}
        style={inputFaced([styles.search, focusEdge(searchEdge.focused, false)], 'sans', bold)}
        {...searching}
        {...searchEdge.edging}
        placeholder={searchLabel}
        {...fieldName(Platform.OS, searchLabel, {
          placeholder: searchLabel,
          filled: { held: search !== '', nameID: searchNameID },
        })}
        testID={`${testID}.search`}
      />
    </View>
  );

  return (
    <>
      <Pressable
        ref={field}
        style={[
          styles.field,
          readOnly && styles.fieldReadOnly,
          drawn != null && styles.fieldCompact,
          wrong && styles.fieldWrong,
        ]}
        onPress={() => {
          controlTaken();
          setClosedEarly(undefined);
          setOpen(true);
        }}
        {...fieldEdge.edging}
        disabled={disabled || readOnly}
        accessibilityRole={readOnly ? undefined : 'button'}
        accessibilityState={{ disabled: disabled || readOnly }}
        accessibilityLabel={refused == null ? name : withInvalid(name, refused.word)}
        accessibilityHint={refusedHint(refused, undefined)}
        aria-invalid={wrong}
        testID={testID}
      >
        <Text
          size={CONTROL_TEXT_SIZE}
          style={[blank ? styles.placeholder : styles.value, drawn != null && styles.valueCompact]}
        >
          {blank ? placeholder : (drawn ?? chosen)}
        </Text>
        {!readOnly && <Chevron />}
        {fieldEdge.focused && <FocusEdge wrong={wrong} />}
      </Pressable>

      <Modal
        visible={windowShown}
        animationType={SLIDES_INSIDE ? 'none' : 'slide'}
        supportedOrientations={TURNS_WITH_THE_APP}
        onRequestClose={() => setOpen(false)}
        onShow={risen}
      >
        {Platform.OS === 'android' && <SilentWindowName />}
        {/* A full-screen modal takes the app's view out of the window, so the app's insets stop turning with it. */}
        <SafeAreaProvider>
          <Animated.View
            style={[styles.fill, SLIDES_INSIDE && { transform: [{ translateY: slide }] }]}
            collapsable={false}
            importantForAccessibility={unnamed ? 'no-hide-descendants' : 'auto'}
            onAccessibilityEscape={() => setOpen(false)}
          >
            <Screen
              style={styles.page}
              contentStyle={beside ? { ...styles.sheet, ...styles.sheetBeside } : styles.sheet}
              scroll={false}
            >
              <View style={styles.sheetHeading}>
                <Text
                  ref={heading}
                  size={tokens.typeTitleDialog.size}
                  weight="bold"
                  accessibilityRole="header"
                  style={beside ? styles.titleBeside : undefined}
                  numberOfLines={beside ? 1 : undefined}
                >
                  {label}
                </Text>
                {beside && searchField}
                <Pressable
                  style={styles.close}
                  onPress={() => setOpen(false)}
                  accessibilityRole="button"
                  testID={`${testID}.close`}
                >
                  <Text size={tokens.typeButton.size} weight="semibold" style={styles.accentText}>
                    {t('countryPicker.close')}
                  </Text>
                </Pressable>
              </View>
              {!beside && searchField}
              <FlatList
                data={shown}
                keyExtractor={(choice) => choice.code}
                windowSize={listFilling ? 1 : undefined}
                keyboardShouldPersistTaps="handled"
                // The modal is its own window, so on iOS only the list's own inset lifts its last row above the keys.
                automaticallyAdjustKeyboardInsets={LIFT.adjustScrollInsets}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.option, item.code === value && styles.optionChosen]}
                    onPress={() => {
                      onChange(item.code);
                      setSearch('');
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: item.code === value }}
                    testID={`${testID}.${item.code}`}
                  >
                    <Text size={CONTROL_TEXT_SIZE} style={styles.optionName}>
                      {item.name}
                    </Text>
                    {item.code === value && (
                      <Text
                        size={tokens.typeButton.size}
                        weight="semibold"
                        style={styles.accentText}
                        accessible={false}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        ✓
                      </Text>
                    )}
                  </Pressable>
                )}
              />
            </Screen>
          </Animated.View>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

// TalkBack reads a window still sliding in as a second app on the screen, so on Android the menu slides inside a window already in place (qa #42888).
const SLIDES_INSIDE = Platform.OS === 'android';

// Android's own window slide: config_shortAnimTime, accelerate-decelerate.
const RISE_EASING = Easing.inOut(Easing.sin);

/** Whether the menu's window is up, and how far its menu has risen in it, 1 in place; on iOS the window slides itself. */
function usePickerRise(shown: boolean, reduced: boolean) {
  const [windowUp, setWindowUp] = useState(false);
  const [rise] = useState(() => new Animated.Value(SLIDES_INSIDE ? 0 : 1));
  if (!SLIDES_INSIDE && !shown && windowUp) setWindowUp(false);

  useEffect(() => {
    if (!SLIDES_INSIDE || !windowUp) return;
    const duration = reduced ? 0 : WINDOW_ARRIVES_MS;
    const motion = Animated.timing(rise, {
      toValue: shown ? 1 : 0,
      duration,
      easing: RISE_EASING,
      useNativeDriver: true,
    });
    motion.start();
    if (shown) return () => motion.stop();
    // Android can lose a native animation's end, so the window goes on a timer of its own.
    const gone = setTimeout(() => setWindowUp(false), duration);

    return () => {
      motion.stop();
      clearTimeout(gone);
    };
  }, [windowUp, shown, reduced, rise]);

  return {
    windowUp,
    rise,
    // A Back taken before the window showed has closed the menu already (sc-43145).
    risen: () => {
      if (shown) setWindowUp(true);
    },
  };
}

/** While the menu opens under TalkBack, the list draws only the rows in sight: Country, still adding rows below as focus moved to its title, had TalkBack draw its focus there and say nothing (qa2 #43597). Rows out of sight follow `SETTLED_MS` after the title takes focus. */
function useListFilling(reader: boolean, up: boolean, revealed: boolean): boolean {
  const [filled, setFilled] = useState(false);
  if (!up && filled) setFilled(false);

  useEffect(() => {
    if (!reader || !revealed || filled) return;
    const fill = setTimeout(() => setFilled(true), SETTLED_MS);

    return () => clearTimeout(fill);
  }, [reader, revealed, filled]);

  return reader && !filled;
}

function Chevron() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="m6 9 6 6 6-6"
        stroke={tokens.colorInkSecondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: tokens.sizeHitPhonePrimary,
    paddingVertical: tokens.spaceSm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
  },
  fieldReadOnly: { backgroundColor: tokens.colorNeutralFill },
  fieldCompact: { minHeight: 56, borderColor: tokens.colorFieldBorder },
  fieldWrong: { borderColor: tokens.colorBroken },
  value: { flex: 1, color: tokens.colorInk },
  // A growing value in a field with no width of its own takes the whole row on Android.
  valueCompact: { flex: 0 },
  placeholder: { flex: 1, color: tokens.colorInkSecondary },
  fill: { flex: 1 },
  page: { backgroundColor: tokens.colorPage },
  sheet: { flex: 1, gap: tokens.spaceLg, padding: tokens.space3xl },
  sheetBeside: { paddingVertical: tokens.spaceLg, gap: tokens.spaceSm },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleBeside: { flexShrink: 1 },
  close: { minHeight: tokens.sizeHit, justifyContent: 'center', paddingHorizontal: tokens.spaceSm },
  accentText: { color: tokens.colorAccentText },
  search: {
    minHeight: tokens.sizeHitPhonePrimary,
    paddingVertical: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
    color: tokens.colorInk,
    fontSize: CONTROL_TEXT_SIZE,
  },
  searchBeside: { flex: 1, marginHorizontal: tokens.spaceLg },
  option: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorInsetBorder,
  },
  optionChosen: { backgroundColor: tokens.colorAccentTint },
  optionName: { flex: 1 },
});
