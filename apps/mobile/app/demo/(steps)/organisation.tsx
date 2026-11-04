import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen, NavBar, closeFlow } from '../../../src/demo/DemoScreen.tsx';
import { InsideField } from '../../../src/steps/InsideField.tsx';
import { Heading, Plain, Says } from '../../../src/steps/Lines.tsx';
import { COUNTRIES, SelectRow } from '../../../src/demo/SelectRow.tsx';
import { tokens } from '../../../src/theme/tokens.ts';

/** The organisation on its own step: its name, and its country set from the phone's region. */
export default function Organisation() {
  const { via } = useLocalSearchParams<{ via?: string }>();
  const short = via === 'google';
  const [name, setName] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]!);
  const [blank, setBlank] = useState(false);
  const field = useRef<TextInputInstance>(null);

  function next(): void {
    if (name.trim() === '') {
      setBlank(true);
      field.current?.focus();
      return;
    }
    router.push({ pathname: '/demo/mobile', params: { via: via ?? 'email' } });
  }

  return (
    <DemoScreen
      nav={
        <NavBar
          left={{ label: 'Sign out', onPress: () => closeFlow('/demo/welcome') }}
          step={short ? [1, 2] : [3, 4]}
        />
      }
      foot={<PrimaryButton label="Continue" onPress={next} testID="demo.continue" />}
    >
      <Heading title="Your organisation" />
      <View style={styles.first}>
        <InsideField
          ref={field}
          label="Organisation name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setBlank(false);
          }}
          state={blank ? 'blank' : 'plain'}
          autoCapitalize="words"
          autoComplete="organization"
          textContentType="organizationName"
          returnKeyType="done"
          testID="demo.organisation"
        />
        {blank && <Says words="Enter your organisation’s name." />}
      </View>
      <Plain>Your events belong to it. You can rename it later.</Plain>
      <View style={styles.next}>
        <SelectRow label="Country" country={country} onChange={setCountry} testID="demo.country" />
      </View>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: tokens.space3xl },
  next: { marginTop: tokens.spaceXxl },
});
