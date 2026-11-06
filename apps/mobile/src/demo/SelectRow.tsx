import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { RadioMark } from '../components/RadioMark.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { Text } from '../components/Text.tsx';
import { tokens } from '../theme/tokens.ts';
import { SheetBody } from '../steps/Lines.tsx';

export interface Country {
  flag: string;
  dial: string;
  name: string;
}

/** A short list for the demo; the build keeps today's searchable list of every country. */
export const COUNTRIES: readonly Country[] = [
  { flag: '🇬🇧', dial: '+44', name: 'United Kingdom' },
  { flag: '🇳🇬', dial: '+234', name: 'Nigeria' },
  { flag: '🇺🇸', dial: '+1', name: 'United States' },
  { flag: '🇪🇸', dial: '+34', name: 'Spain' },
  { flag: '🇫🇷', dial: '+33', name: 'France' },
  { flag: '🇧🇷', dial: '+55', name: 'Brazil' },
  { flag: '🇵🇹', dial: '+351', name: 'Portugal' },
  { flag: '🇲🇽', dial: '+52', name: 'Mexico' },
];

/** The label inside, the value under it and a chevron: a field that opens a list. */
export function SelectRow({
  label,
  country,
  onChange,
  compact = false,
  testID,
}: {
  label: string;
  country: Country;
  onChange: (country: Country) => void;
  /** The calling code alone, "🇬🇧 +44", beside a number. */
  compact?: boolean;
  testID: string;
}) {
  const opener = useRef<ViewInstance>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        ref={opener}
        style={[styles.row, compact && styles.compact]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          compact ? `${label}, ${country.name}, ${country.dial}` : `${label}, ${country.name}`
        }
        testID={testID}
      >
        {compact ? (
          <Text size={17} weight="semibold" accessible={false}>
            {`${country.flag} ${country.dial}`}
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
              {country.name}
            </Text>
          </View>
        )}
        <Chevron />
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
                accessibilityState={{ checked: choice.name === country.name }}
                accessibilityLabel={compact ? `${choice.name}, ${choice.dial}` : choice.name}
                testID={`${testID}.${choice.dial}`}
              >
                <RadioMark on={choice.name === country.name} />
                <Text
                  size={tokens.typeBodyGuest.size}
                  style={styles.choiceWords}
                  accessible={false}
                >
                  {compact
                    ? `${choice.flag}  ${choice.name}  ${choice.dial}`
                    : `${choice.flag}  ${choice.name}`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </SheetBody>
      </Sheet>
    </>
  );
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
