import { type PhoneLengthProblem, phoneLengthProblem } from '@soirely/domain';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '../../components/Buttons.tsx';
import { CountryPicker } from '../../components/CountryPicker.tsx';
import { Field, TextField } from '../../components/Field.tsx';
import { phoneProblemMessage } from '../../phoneProblem.ts';
import { tokens } from '../../theme/tokens.ts';
import { COUNTRY_BASIS, NUMBER_BASIS } from '../phoneCountryFit.ts';
import { usePhoneCountryFits } from '../phoneCountryFits.tsx';
import { phoneCountryOverNumber } from './textSizeRules.ts';

/** Changez votre numéro de portable's number as proposed at a text size: the country beside the number while its name fits there on one line; over it, each the field's full width, once it does not (sc-7579, #104845) and always from the accessibility sizes on (sc-78438). */
export function TextSizePhone({ scale }: { scale: number }) {
  const { t } = useTranslation();
  const [country, setCountry] = useState('GB');
  const [number, setNumber] = useState('');
  const [refused, setRefused] = useState<PhoneLengthProblem | null>(null);
  const { over, onRowLayout, measure } = usePhoneCountryFits(
    country,
    phoneCountryOverNumber(scale),
  );
  const error = phoneProblemMessage(refused, country, t);

  return (
    <View style={styles.part} testID="demo.textSize.phone">
      <Field label={t('verifyPhone.numberLabel')} help={t('verifyPhone.numberHelp')} error={error}>
        <View
          key={over ? 'over' : 'beside'}
          style={over ? styles.over : styles.beside}
          onLayout={onRowLayout}
          testID={`demo.textSize.phone.${over ? 'over' : 'beside'}`}
        >
          {measure}
          <View style={over ? styles.whole : styles.country}>
            <CountryPicker
              label={t('verifyPhone.countryLabel')}
              value={country}
              onChange={(code) => {
                setCountry(code);
                setRefused(null);
              }}
              withCallingCode
              testID="demo.textSize.phone.country"
            />
          </View>
          <TextField
            style={over ? styles.whole : styles.number}
            value={number}
            wrong={error != null}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            returnKeyType="done"
            onChangeText={(typed) => {
              setNumber(typed);
              setRefused(null);
            }}
            accessibilityLabel={t('verifyPhone.numberLabel')}
            testID="demo.textSize.phone.number"
          />
        </View>
      </Field>
      <PrimaryButton
        label={t('verifyPhone.send')}
        onPress={() => setRefused(phoneLengthProblem(number, country))}
        testID="demo.textSize.phone.send"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  part: { gap: tokens.spaceMd },
  beside: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  over: { gap: tokens.spaceSm },
  country: { flexGrow: 1, flexBasis: COUNTRY_BASIS },
  number: { flexGrow: 2, flexBasis: NUMBER_BASIS },
  whole: { alignSelf: 'stretch' },
});
