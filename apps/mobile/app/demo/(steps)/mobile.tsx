import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import { focusPicker } from '../../../src/components/CountryPicker.tsx';
import { DemoScreen, NavBar, finish } from '../../../src/demo/DemoScreen.tsx';
import { InsideField } from '../../../src/steps/InsideField.tsx';
import { Heading, Plain, Says } from '../../../src/steps/Lines.tsx';
import { SelectRow } from '../../../src/demo/SelectRow.tsx';
import { mobileRefusal, startCountry } from '../../../src/demo/signUpChecks.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** The last step, which Skip at the top right passes. */
export default function Mobile() {
  const { via, region } = useLocalSearchParams<{ via?: string; region?: string }>();
  const short = via === 'google' || via === 'apple';
  const [country, setCountry] = useState(() => startCountry(region));
  const [number, setNumber] = useState('');
  const [refused, setRefused] = useState<ReturnType<typeof mobileRefusal>>(null);
  const field = useRef<TextInputInstance>(null);
  const picker = useRef<ViewInstance>(null);

  function send(): void {
    const found = mobileRefusal(number, country);
    setRefused(found);
    if (found?.on === 'number') field.current?.focus();
    if (found?.on === 'country') focusPicker(picker);
    if (found != null || country == null) return;
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
        intro="So your team can reach you on the night if something goes wrong."
      />
      <View style={styles.row}>
        <SelectRow
          label="Country code"
          country={country}
          onChange={(chosen) => {
            setCountry(chosen);
            if (refused?.on === 'country') setRefused(null);
          }}
          compact
          wrong={refused?.on === 'country'}
          pickerRef={picker}
          testID="demo.dial"
        />
        <View style={styles.number}>
          <InsideField
            ref={field}
            label="Mobile number"
            value={number}
            onChangeText={(text) => {
              setNumber(text);
              if (refused?.on === 'number') setRefused(null);
            }}
            state={refused?.on === 'number' ? 'blank' : 'plain'}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            autoFocus
            testID="demo.number"
          />
        </View>
      </View>
      {refused != null && <Says words={refused.words} />}
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
