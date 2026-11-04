import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen, NavBar, closeFlow } from '../../../src/demo/DemoScreen.tsx';
import { InsideField } from '../../../src/steps/InsideField.tsx';
import { Heading, Plain, Says } from '../../../src/steps/Lines.tsx';
import { COUNTRIES, SelectRow } from '../../../src/demo/SelectRow.tsx';
import { tokens } from '../../../src/theme/tokens.ts';

/** A first Apple sign-in that didn't share the name: asked once, here, with the organisation. */
export default function AppleFirst() {
  const [name, setName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]!);
  const [blank, setBlank] = useState<'name' | 'organisation' | null>(null);
  const nameField = useRef<TextInputInstance>(null);
  const organisationField = useRef<TextInputInstance>(null);

  function next(): void {
    if (name.trim() === '') {
      setBlank('name');
      nameField.current?.focus();
      return;
    }
    if (organisation.trim() === '') {
      setBlank('organisation');
      organisationField.current?.focus();
      return;
    }
    router.push({ pathname: '/demo/mobile', params: { via: 'apple' } });
  }

  return (
    <DemoScreen
      nav={
        <NavBar
          left={{ label: 'Sign out', onPress: () => closeFlow('/demo/welcome') }}
          step={[1, 2]}
        />
      }
      foot={<PrimaryButton label="Continue" onPress={next} testID="demo.continue" />}
    >
      <Heading title="Your organisation" />
      <View style={styles.first}>
        <InsideField
          ref={nameField}
          label="Full name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setBlank(null);
          }}
          state={blank === 'name' ? 'blank' : 'plain'}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => organisationField.current?.focus()}
          testID="demo.name"
        />
        {blank === 'name' && <Says words="Enter your name." />}
      </View>
      <Plain>Apple didn’t share your name, so we ask it once.</Plain>
      <View style={styles.next}>
        <InsideField
          ref={organisationField}
          label="Organisation name"
          value={organisation}
          onChangeText={(text) => {
            setOrganisation(text);
            setBlank(null);
          }}
          state={blank === 'organisation' ? 'blank' : 'plain'}
          autoCapitalize="words"
          autoComplete="organization"
          textContentType="organizationName"
          returnKeyType="done"
          testID="demo.organisation"
        />
        {blank === 'organisation' && <Says words="Enter your organisation’s name." />}
      </View>
      <View style={styles.next}>
        <SelectRow label="Country" country={country} onChange={setCountry} testID="demo.country" />
      </View>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: tokens.space3xl },
  next: { marginTop: tokens.spaceXl },
});
