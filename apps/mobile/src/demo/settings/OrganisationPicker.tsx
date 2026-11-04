import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextField } from '../../components/Field.tsx';
import { LIFT } from '../../components/keyboardWatch.ts';
import { Text } from '../../components/Text.tsx';
import { TURNS_WITH_THE_APP } from '../../layout/orientations.ts';
import { tokens } from '../../theme/tokens.ts';
import { useModalOpen } from '../../updateRequired.ts';
import { Glyph } from '../Glyph.tsx';
import { DETAILS_WORDS } from './OrganisationWords.ts';

export interface Choice {
  code: string;
  name: string;
}

const FIELD_HEIGHT = 52;

/** A picker is a field with a chevron; it opens a white full-screen list that slides up, in a 640 column on a tablet. */
export function OrganisationPicker({
  label,
  searchLabel,
  choices,
  value,
  onChange,
  startsOpen = false,
  tablet,
  testID,
}: {
  label: string;
  searchLabel: string;
  choices: readonly Choice[];
  value: string;
  onChange: (code: string) => void;
  startsOpen?: boolean;
  tablet: boolean;
  testID: string;
}) {
  const [open, setOpen] = useState(startsOpen);
  const shown = useModalOpen(open);
  const chosen = choices.find((choice) => choice.code === value)?.name ?? value;
  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen}`}
        testID={testID}
      >
        <Text size={16} weight="medium" style={styles.grow}>
          {chosen}
        </Text>
        <Glyph name="down" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
      </Pressable>
      <Modal
        visible={shown}
        animationType="slide"
        supportedOrientations={TURNS_WITH_THE_APP}
        onRequestClose={close}
      >
        <SafeAreaProvider>
          <View style={styles.fill} collapsable={false} onAccessibilityEscape={close}>
            <PickerPage
              label={label}
              searchLabel={searchLabel}
              choices={choices}
              value={value}
              tablet={tablet}
              onChoose={(code) => {
                onChange(code);
                close();
              }}
              onClose={close}
              testID={testID}
            />
          </View>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

function PickerPage({
  label,
  searchLabel,
  choices,
  value,
  tablet,
  onChoose,
  onClose,
  testID,
}: {
  label: string;
  searchLabel: string;
  choices: readonly Choice[];
  value: string;
  tablet: boolean;
  onChoose: (code: string) => void;
  onClose: () => void;
  testID: string;
}) {
  const insets = useSafeAreaInsets();
  const [needle, setNeedle] = useState('');
  const wanted = needle.trim().toLocaleLowerCase('en');
  const shown =
    wanted === ''
      ? choices
      : choices.filter((choice) => choice.name.toLocaleLowerCase('en').includes(wanted));

  return (
    <View
      style={[
        styles.page,
        { paddingTop: insets.top + (tablet ? 28 : tokens.spaceSm), paddingBottom: insets.bottom },
      ]}
    >
      <View style={[styles.column, tablet ? styles.columnTablet : styles.columnPhone]}>
        <View style={styles.head}>
          <Text size={22} weight="bold" accessibilityRole="header" style={styles.title}>
            {label}
          </Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.done, pressed && styles.pressed]}
            accessibilityRole="button"
            testID={`${testID}.close`}
          >
            <Text size={16} weight="semibold" style={styles.accent}>
              {DETAILS_WORDS.done}
            </Text>
          </Pressable>
        </View>
        <View>
          <TextField
            accessibilityLabel={searchLabel}
            placeholder={searchLabel}
            placeholderTextColor={tokens.colorInkSecondary}
            defaultValue=""
            onChangeText={setNeedle}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.search}
            testID={`${testID}.search`}
          />
          <View style={styles.searchMark} pointerEvents="none">
            <Glyph name="search" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
          </View>
        </View>
        <FlatList
          data={shown}
          keyExtractor={(choice) => choice.code}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={LIFT.adjustScrollInsets}
          style={styles.list}
          renderItem={({ item }) => {
            const on = item.code === value;

            return (
              <Pressable
                onPress={() => onChoose(item.code)}
                style={({ pressed }) => [
                  styles.option,
                  on && styles.optionOn,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                testID={`${testID}.${item.code}`}
              >
                <Text size={16} weight={on ? 'semibold' : 'medium'} style={styles.grow}>
                  {item.name}
                </Text>
                {on && <Glyph name="tick" size={18} ink={tokens.colorAccentText} weight={2.6} />}
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  fill: { flex: 1 },
  pressed: { opacity: 0.8 },
  field: {
    minHeight: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXl,
    borderWidth: 1,
    borderColor: tokens.colorFieldBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
  },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  column: { flex: 1, gap: 14 },
  columnPhone: { paddingHorizontal: tokens.spaceXxl },
  columnTablet: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: tokens.spaceXl },
  head: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  title: { flex: 1, letterSpacing: 22 * -0.015 },
  done: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceSm,
  },
  accent: { color: tokens.colorAccentText },
  search: { minHeight: FIELD_HEIGHT, paddingLeft: 44 },
  searchMark: {
    position: 'absolute',
    left: tokens.spaceXl,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  list: { flex: 1 },
  option: {
    minHeight: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXl,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  optionOn: { backgroundColor: tokens.colorAccentTint },
});
