import { callingCode, countryChoices } from '@soirely/domain';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { currentLocale } from '../i18n/index.ts';
import { tokens } from '../theme/tokens.ts';
import { Screen } from './Screen.tsx';
import { Text } from './Text.tsx';

const CONTROL_TEXT_SIZE = 16;

/** A select, as the artboard draws one: the chosen country in a field, and the whole list one tap away. */
export function CountryPicker({
  label,
  value,
  onChange,
  disabled = false,
  withCallingCode = false,
  testID,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  /** For a phone: "+234 Nigeria", and only countries that can be dialled. */
  withCallingCode?: boolean;
  testID: string;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const choices = useMemo(
    () =>
      countryChoices(locale).flatMap((choice) => {
        if (!withCallingCode) return [choice];
        const code = callingCode(choice.code);

        return code == null ? [] : [{ ...choice, name: `${code} ${choice.name}` }];
      }),
    [locale, withCallingCode],
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const chosen = choices.find((choice) => choice.code === value)?.name ?? value;
  const needle = search.trim().toLocaleLowerCase(locale);
  const shown =
    needle === ''
      ? choices
      : choices.filter((choice) => choice.name.toLocaleLowerCase(locale).includes(needle));

  return (
    <>
      <Pressable
        style={styles.field}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen}`}
        testID={testID}
      >
        <Text size={CONTROL_TEXT_SIZE} style={styles.value}>
          {chosen}
        </Text>
        <Chevron />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <Screen style={styles.page} contentStyle={styles.sheet} scroll={false}>
          <View style={styles.sheetHeading}>
            <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
              {label}
            </Text>
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
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder={t('countryPicker.search')}
            placeholderTextColor={tokens.colorInkTertiary}
            cursorColor={tokens.colorInk}
            selectionColor={tokens.colorInk}
            autoCorrect={false}
            spellCheck={false}
            accessibilityLabel={t('countryPicker.search')}
            testID={`${testID}.search`}
          />
          <FlatList
            data={shown}
            keyExtractor={(choice) => choice.code}
            keyboardShouldPersistTaps="handled"
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
                  <Text size={tokens.typeButton.size} weight="semibold" style={styles.accentText}>
                    ✓
                  </Text>
                )}
              </Pressable>
            )}
          />
        </Screen>
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
    height: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
  },
  value: { flex: 1, color: tokens.colorInk },
  page: { backgroundColor: tokens.colorPage },
  sheet: { flex: 1, gap: tokens.spaceLg, padding: tokens.space3xl },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { minHeight: tokens.sizeHit, justifyContent: 'center', paddingHorizontal: tokens.spaceSm },
  accentText: { color: tokens.colorAccentText },
  search: {
    height: tokens.sizeHitPhonePrimary,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
    color: tokens.colorInk,
    fontSize: CONTROL_TEXT_SIZE,
  },
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
