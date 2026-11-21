import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CountryPicker } from '../../components/CountryPicker.tsx';
import { Field, TextField } from '../../components/Field.tsx';
import { tokens } from '../../theme/tokens.ts';
import { phoneCountryOverNumber } from './textSizeRules.ts';

/** The phone step's number as proposed at a text size: the country beside the number at the default sizes; from the accessibility sizes on, over it, each the field's full width. */
export function TextSizePhone({ scale }: { scale: number }) {
  const { t } = useTranslation();
  const [country, setCountry] = useState('GB');
  const [number, setNumber] = useState('');
  const over = phoneCountryOverNumber(scale);

  return (
    <View testID="demo.textSize.phone">
      <Field label={t('verifyPhone.numberLabel')} help={t('verifyPhone.numberHelp')} error={null}>
        <View
          style={over ? styles.over : styles.beside}
          testID={`demo.textSize.phone.${over ? 'over' : 'beside'}`}
        >
          <View style={over ? styles.whole : styles.country}>
            <CountryPicker
              label={t('verifyPhone.countryLabel')}
              value={country}
              onChange={setCountry}
              withCallingCode
              testID="demo.textSize.phone.country"
            />
          </View>
          <TextField
            style={over ? styles.whole : styles.number}
            value={number}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            returnKeyType="done"
            onChangeText={setNumber}
            accessibilityLabel={t('verifyPhone.numberLabel')}
            testID="demo.textSize.phone.number"
          />
        </View>
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({
  beside: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  over: { gap: tokens.spaceSm },
  country: { flexGrow: 1, flexBasis: 140 },
  number: { flexGrow: 2, flexBasis: 180 },
  whole: { alignSelf: 'stretch' },
});
