import { callingCode, countryChoices } from '@soirely/domain';
import { type ReactElement, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { Text } from '../components/Text.tsx';
import { currentLocale } from '../i18n/index.ts';
import { CONTROL_TEXT_SIZE } from '../layout/textSize.ts';
import { countryOverNumber } from './phoneCountryFit.ts';

/** The phone row's choice of layout, from the chosen country's name measured unseen at the picker's own size and the row's width. */
export function usePhoneCountryFits(
  country: string,
  atAccessibilitySizes: boolean,
): { over: boolean; onRowLayout: (event: LayoutChangeEvent) => void; measure: ReactElement } {
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const [nameWidth, setNameWidth] = useState<number | null>(null);
  const name = countryChoices(currentLocale()).find((choice) => choice.code === country)?.name;
  const code = callingCode(country);
  const shown = code == null || name == null ? (name ?? country) : `${code} ${name}`;

  return {
    over: countryOverNumber(atAccessibilitySizes, nameWidth, rowWidth),
    onRowLayout: (event) => setRowWidth(event.nativeEvent.layout.width),
    measure: (
      <View
        style={styles.unseen}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text
          key={shown}
          size={CONTROL_TEXT_SIZE}
          accessible={false}
          onLayout={(event) => setNameWidth(event.nativeEvent.layout.width)}
        >
          {shown}
        </Text>
      </View>
    ),
  };
}

const styles = StyleSheet.create({
  unseen: { position: 'absolute', top: 0, left: 0, opacity: 0 },
});
