import { callingCode, countryChoices } from '@soirely/domain';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MeasuredWords } from '../components/Title.tsx';
import { currentLocale } from '../i18n/index.ts';
import { CONTROL_TEXT_SIZE } from '../layout/textSize.ts';
import { tokens } from '../theme/tokens.ts';
import { COUNTRY_BASIS, NUMBER_BASIS, countryOverNumber } from './phoneCountryFit.ts';

/** A phone number's row: the country picker beside the number while the chosen country's name, measured unseen at the picker's own size, fits there on one line, and over it otherwise, each the field's full width (sc-7579, #104845). */
export function PhoneCountryRow({
  country,
  atAccessibilitySizes,
  picker,
  field,
  testID,
}: {
  country: string;
  atAccessibilitySizes: boolean;
  picker: ReactNode;
  field: ReactNode;
  testID?: string;
}) {
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const [nameWidth, setNameWidth] = useState<number | null>(null);
  const name = countryChoices(currentLocale()).find((choice) => choice.code === country)?.name;
  const code = callingCode(country);
  const shown = code == null || name == null ? (name ?? country) : `${code} ${name}`;
  const over = countryOverNumber(atAccessibilitySizes, nameWidth, rowWidth);

  return (
    <View
      style={over ? styles.over : styles.beside}
      onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      {...(testID == null ? {} : { testID: `${testID}.${over ? 'over' : 'beside'}` })}
    >
      <MeasuredWords
        words={[shown]}
        size={CONTROL_TEXT_SIZE}
        onWidth={(_, width) => setNameWidth(width)}
      />
      <View style={over ? styles.whole : styles.country}>{picker}</View>
      <View style={over ? styles.whole : styles.number}>{field}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  beside: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  over: { gap: tokens.spaceSm },
  country: { flexGrow: 1, flexBasis: COUNTRY_BASIS },
  number: { flexGrow: 2, flexBasis: NUMBER_BASIS },
  whole: { alignSelf: 'stretch' },
});
