import type { Ref } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { CountryPicker } from './CountryPicker.tsx';
import { Field, TextField } from './Field.tsx';

/** The code and the number side by side, as Verify phone draws them. */
export function PhoneEntry({
  label,
  pill,
  help,
  country,
  error,
  errorOn = 'number',
  submitting,
  ref,
  pickerRef,
  onCountry,
  onNumber,
  onSubmit,
  testID,
}: {
  label: string;
  pill?: string | undefined;
  help: string;
  country: string;
  error: string | null | undefined;
  /** The control the line names takes the red edge: "Choose a country." is about the code (sc-30447). */
  errorOn?: 'country' | 'number';
  /** A submit runs: the picker is off and the number held. */
  submitting: boolean;
  ref?: Ref<TextInputInstance> | undefined;
  pickerRef?: Ref<ViewInstance> | undefined;
  onCountry: (code: string) => void;
  onNumber: (typed: string) => void;
  onSubmit: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <Field label={label} pill={pill} error={error} help={help}>
      <View style={styles.entry}>
        <View style={styles.country}>
          <CountryPicker
            label={t('verifyPhone.countryLabel')}
            value={country}
            onChange={onCountry}
            disabled={submitting}
            withCallingCode
            wrong={error != null && errorOn === 'country'}
            pickerRef={pickerRef}
            testID={`${testID}.country`}
          />
        </View>
        <TextField
          ref={ref}
          style={styles.number}
          wrong={error != null && errorOn === 'number'}
          submitting={submitting}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          returnKeyType="done"
          onChangeText={onNumber}
          onSubmitEditing={onSubmit}
          submitBehavior="submit"
          accessibilityLabel={label}
          testID={`${testID}.number`}
        />
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  entry: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  country: { flexGrow: 1, flexBasis: 140 },
  number: { flexGrow: 2, flexBasis: 180 },
});
