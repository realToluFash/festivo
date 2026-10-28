import { type Ref, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { currentLocale } from '../i18n/index.ts';
import { fieldName } from '../kit/fields.ts';
import { searchBesideTitle } from '../kit/keyboard.ts';
import { TURNS_WITH_THE_APP } from '../layout/orientations.ts';
import { useLayout } from '../layout/useLayout.ts';
import { faced } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { LIFT } from './keyboardWatch.ts';
import { Screen } from './Screen.tsx';
import { Text } from './Text.tsx';

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
  /** For moving screen-reader focus here when it is the field refused first. */
  pickerRef?: Ref<View> | undefined;
  testID: string;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { kind, width, height } = useLayout();
  const beside = searchBesideTitle({ os: Platform.OS, phone: kind === 'phone', width, height });

  const chosen = choices.find((choice) => choice.code === value)?.name ?? value;
  const blank = chosen === '';
  const needle = search.trim().toLocaleLowerCase(locale);
  const shown =
    needle === ''
      ? choices
      : choices.filter((choice) => choice.name.toLocaleLowerCase(locale).includes(needle));

  const searchField = (
    <TextInput
      style={faced(beside ? [styles.search, styles.searchBeside] : styles.search)}
      value={search}
      onChangeText={setSearch}
      placeholder={searchLabel}
      placeholderTextColor={tokens.colorInkTertiary}
      cursorColor={tokens.colorInk}
      selectionColor={tokens.colorInk}
      autoCorrect={false}
      spellCheck={false}
      {...fieldName(Platform.OS, searchLabel, { placeholder: searchLabel })}
      testID={`${testID}.search`}
    />
  );

  return (
    <>
      <Pressable
        ref={pickerRef}
        style={[styles.field, readOnly && styles.fieldReadOnly]}
        onPress={() => setOpen(true)}
        disabled={disabled || readOnly}
        accessibilityRole={readOnly ? undefined : 'button'}
        accessibilityState={{ disabled: disabled || readOnly }}
        accessibilityLabel={blank ? label : `${label}: ${chosen}`}
        testID={testID}
      >
        <Text size={CONTROL_TEXT_SIZE} style={blank ? styles.placeholder : styles.value}>
          {blank ? placeholder : chosen}
        </Text>
        {!readOnly && <Chevron />}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        supportedOrientations={TURNS_WITH_THE_APP}
        onRequestClose={() => setOpen(false)}
      >
        {/* A full-screen modal takes the app's view out of the window, so the app's insets stop turning with it. */}
        <SafeAreaProvider>
          <View
            style={styles.fill}
            collapsable={false}
            onAccessibilityEscape={() => setOpen(false)}
          >
            <Screen
              style={styles.page}
              contentStyle={beside ? { ...styles.sheet, ...styles.sheetBeside } : styles.sheet}
              scroll={false}
            >
              <View style={styles.sheetHeading}>
                <Text
                  size={tokens.typeTitleDialog.size}
                  weight="bold"
                  accessibilityRole="header"
                  style={beside ? styles.titleBeside : undefined}
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
          </View>
        </SafeAreaProvider>
      </Modal>
    </>
  );
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
  value: { flex: 1, color: tokens.colorInk },
  placeholder: { flex: 1, color: tokens.colorInkTertiary },
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
