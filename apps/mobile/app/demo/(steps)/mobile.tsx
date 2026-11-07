import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen, NavBar, finish } from '../../../src/demo/DemoScreen.tsx';
import { InsideField } from '../../../src/steps/InsideField.tsx';
import { Heading, Plain, Says } from '../../../src/steps/Lines.tsx';
import { COUNTRIES, SelectRow } from '../../../src/demo/SelectRow.tsx';
import { tokens } from '../../../src/theme/tokens.ts';

/** The last step, which Skip at the top right passes. */
export default function Mobile() {
  const { via } = useLocalSearchParams<{ via?: string }>();
  const short = via === 'google' || via === 'apple';
  const [country, setCountry] = useState(COUNTRIES[0]!);
  const [number, setNumber] = useState('');
  const [blank, setBlank] = useState(false);
  const field = useRef<TextInputInstance>(null);

  function send(): void {
    if (number.replace(/\D/gu, '').length < 6) {
      setBlank(true);
      field.current?.focus();
      return;
    }
    router.push({
      pathname: '/demo/phone-code',
      params: { via: via ?? 'email', phone: `${country.dial} ${number.trim()}` },
    });
  }

  return (
    <DemoScreen
      nav={
        <NavBar step={short ? [2, 2] : [4, 4]} right={{ label: 'Skip', onPress: () => finish() }} />
      }
      foot={<PrimaryButton label="Send code" onPress={send} testID="demo.sendCode" />}
    >
      <Heading
        title="Your mobile number"
        intro="So your team can reach you on the day if something goes wrong."
      />
      <View style={styles.row}>
        <SelectRow
          label="Country code"
          country={country}
          onChange={setCountry}
          compact
          testID="demo.dial"
        />
        <View style={styles.number}>
          <InsideField
            ref={field}
            label="Mobile number"
            value={number}
            onChangeText={(text) => {
              setNumber(text);
              setBlank(false);
            }}
            state={blank ? 'blank' : 'plain'}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            autoFocus
            testID="demo.number"
          />
        </View>
      </View>
      {blank && <Says words="Enter your mobile number." />}
      <Plain>We send it a code on WhatsApp, or by text if WhatsApp can’t reach you.</Plain>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: tokens.space3xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
  },
  number: { flex: 1 },
});
