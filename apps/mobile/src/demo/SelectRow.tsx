import { type RefObject, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FocusEdge, useFocusEdge } from '../components/Field.tsx';
import { RadioMark } from '../components/RadioMark.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { Text } from '../components/Text.tsx';
import { tokens } from '../theme/tokens.ts';
import { SheetBody } from '../steps/Lines.tsx';
import { COUNTRIES, type Country } from './countries.ts';

/** A field that opens a list: the value and a chevron, with the label inside unless a Field above draws it. */
export function SelectRow({
  label,
  country,
  onChange,
  compact = false,
  withCallingCode = false,
  labelled = false,
  wrong = false,
  pickerRef,
  testID,
}: {
  label: string;
  /** Null until one is chosen: the label alone, as an empty field shows it. */
  country: Country | null;
  onChange: (country: Country) => void;
  /** The calling code alone, "🇬🇧 +44", beside a number. */
  compact?: boolean;
  /** For a phone: "+44 United Kingdom", as the app's mobile field shows it (sc-62). */
  withCallingCode?: boolean;
  /** A Field above it draws the label, as the app's pickers sit, so the box holds the value alone. */
  labelled?: boolean;
  /** A line about it shows under it: a refused text field's red edge, 2pt with focus (sc-30447). */
  wrong?: boolean;
  /** Where a refusal naming it sends the screen reader. */
  pickerRef?: RefObject<ViewInstance | null>;
  testID: string;
}) {
  const own = useRef<ViewInstance>(null);
  const opener = pickerRef ?? own;
  const [open, setOpen] = useState(false);
  const { focused, edging } = useFocusEdge();

  return (
    <>
      <Pressable
        ref={opener}
        style={[styles.row, compact && styles.compact, wrong && styles.wrong]}
        onPress={() => setOpen(true)}
        {...edging}
        accessibilityRole="button"
        accessibilityLabel={
          country == null
            ? label
            : compact
              ? `${label}, ${country.name}, ${country.dial}`
              : `${label}, ${named(country, withCallingCode)}`
        }
        aria-invalid={wrong}
        testID={testID}
      >
        {country == null ? (
          <Text
            size={17}
            weight="medium"
            style={[styles.label, !compact && styles.grow]}
            accessible={false}
          >
            {label}
          </Text>
        ) : compact ? (
          <Text size={17} weight="semibold" accessible={false}>
            {`${country.flag} ${country.dial}`}
          </Text>
        ) : labelled ? (
          <Text size={17} style={styles.grow} accessible={false}>
            {named(country, withCallingCode)}
          </Text>
        ) : (
          <View style={styles.words}>
            <Text
              size={tokens.typeSmall.size}
              weight="medium"
              style={styles.label}
              accessible={false}
            >
              {label}
            </Text>
            <Text size={17} accessible={false}>
              {named(country, withCallingCode)}
            </Text>
          </View>
        )}
        <Chevron />
        {wrong && focused && <FocusEdge wrong />}
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} opener={opener} testID={`${testID}.sheet`}>
        <SheetBody>
          <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
            {label}
          </Text>
          <ScrollView style={styles.list}>
            {COUNTRIES.map((choice) => (
              <Pressable
                key={choice.name}
                style={styles.choice}
                onPress={() => {
                  onChange(choice);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: choice.name === country?.name }}
                accessibilityLabel={
                  compact ? `${choice.name}, ${choice.dial}` : named(choice, withCallingCode)
                }
                testID={`${testID}.${choice.dial}`}
              >
                <RadioMark on={choice.name === country?.name} />
                <Text
                  size={tokens.typeBodyGuest.size}
                  style={styles.choiceWords}
                  accessible={false}
                >
                  {compact
                    ? `${choice.flag}  ${choice.name}  ${choice.dial}`
                    : `${choice.flag}  ${named(choice, withCallingCode)}`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </SheetBody>
      </Sheet>
    </>
  );
}

function named(country: Country, withCallingCode: boolean): string {
  return withCallingCode ? `${country.dial} ${country.name}` : country.name;
}

function Chevron() {
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tokens.colorInkSecondary}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXl - 1,
    borderWidth: 1,
    borderColor: tokens.colorFieldBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
  },
  compact: { paddingHorizontal: tokens.spaceLg },
  wrong: { borderColor: tokens.colorBroken },
  grow: { flex: 1 },
  words: { flex: 1, gap: 1, paddingVertical: tokens.spaceSm },
  label: { color: tokens.colorInkSecondary },
  list: { marginTop: tokens.spaceLg, maxHeight: 420 },
  choice: {
    minHeight: tokens.sizeListRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  choiceWords: { flex: 1 },
});
