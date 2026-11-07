import type { Ref } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CountryPicker } from '../../components/CountryPicker.tsx';
import { Field, TextField } from '../../components/Field.tsx';
import { tokens } from '../../theme/tokens.ts';
import { PickerEdge } from '../PickerEdge.tsx';

/** The product's PhoneEntry as sc-30447 draws it: the red edge goes on the control the line names, the Code or the number. */
// Goes once sc-30447's build gives PhoneEntry the edge: AccountAdd.tsx renders PhoneEntry again.
export function AccountPhoneEntry({
  label,
  help,
  country,
  error,
  errorOn,
  ref,
  pickerRef,
  onCountry,
  onNumber,
  onSubmit,
  testID,
}: {
  label: string;
  help: string;
  country: string;
  error: string | null;
  errorOn: 'country' | 'number';
  ref?: Ref<TextInputInstance> | undefined;
  /** Where "Choose a country." sends the focus: the Code, which its edge marks. */
  pickerRef?: Ref<ViewInstance> | undefined;
  onCountry: (code: string) => void;
  onNumber: (typed: string) => void;
  onSubmit: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <Field label={label} error={error} help={help}>
      <View style={styles.entry}>
        <View style={styles.country}>
          <PickerEdge wrong={error != null && errorOn === 'country'}>
            <CountryPicker
              label={t('verifyPhone.countryLabel')}
              value={country}
              onChange={onCountry}
              withCallingCode
              pickerRef={pickerRef}
              testID={`${testID}.country`}
            />
          </PickerEdge>
        </View>
        <TextField
          ref={ref}
          style={styles.number}
          wrong={error != null && errorOn === 'number'}
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
