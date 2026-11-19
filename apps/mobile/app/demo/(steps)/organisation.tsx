import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import { focusPicker } from '../../../src/components/CountryPicker.tsx';
import { OrgTile } from '../../../src/components/OrgTile.tsx';
import { Text } from '../../../src/components/Text.tsx';
import { DemoScreen, NavBar, closeFlow } from '../../../src/demo/DemoScreen.tsx';
import { ManagedBanner } from '../../../src/demo/Managed.tsx';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { managedStateOf, managedStep } from '../../../src/demo/signUpEnd.ts';
import { InsideField } from '../../../src/steps/InsideField.tsx';
import { Heading, Plain, Says } from '../../../src/steps/Lines.tsx';
import { SelectRow } from '../../../src/demo/SelectRow.tsx';
import { COUNTRY_BLANK, startCountry } from '../../../src/demo/signUpChecks.ts';
import { tokens } from '../../../src/theme/tokens.ts';

export default function Organisation() {
  const { state, via } = useLocalSearchParams<{ state?: string; via?: string }>();
  const managed = managedStateOf(state);

  if (managed != null) return <Managed step={managedStep(managed)} short={via === 'google'} />;

  return <OwnOrganisation />;
}

/** The organisation on its own step: its name, and its country set from the phone's region. */
function OwnOrganisation() {
  const { via, region } = useLocalSearchParams<{ via?: string; region?: string }>();
  const short = via === 'google';
  const [name, setName] = useState('');
  const [country, setCountry] = useState(() => startCountry(region));
  const [blank, setBlank] = useState(false);
  const [noCountry, setNoCountry] = useState(false);
  const field = useRef<TextInputInstance>(null);
  const picker = useRef<ViewInstance>(null);

  function next(): void {
    const nameBlank = name.trim() === '';
    setBlank(nameBlank);
    setNoCountry(country == null);
    if (nameBlank) {
      field.current?.focus();
      return;
    }
    if (country == null) {
      focusPicker(picker);
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
        <SelectRow
          label="Country"
          country={country}
          onChange={(chosen) => {
            setCountry(chosen);
            setNoCountry(false);
          }}
          wrong={noCountry}
          pickerRef={picker}
          testID="demo.country"
        />
        {noCountry && <Says words={COUNTRY_BLANK} />}
      </View>
    </DemoScreen>
  );
}

/** No Change your main email address here: Account settings is behind the onboarding gate (sc-563). */
function Managed({ step, short }: { step: ReturnType<typeof managedStep>; short: boolean }) {
  const { offer } = step;
  const next = () =>
    router.push({
      pathname: '/demo/mobile',
      params: { via: short ? 'google' : 'email', end: step.end },
    });

  return (
    <DemoScreen
      nav={
        <NavBar
          left={{ label: 'Sign out', onPress: () => closeFlow('/demo/welcome') }}
          step={short ? [1, 2] : [3, 4]}
        />
      }
      foot={
        <PrimaryButton
          label={step.action}
          onPress={next}
          testID={offer ? 'organisation.managed.ask' : 'demo.continue'}
        />
      }
    >
      <Heading title="Your organisation" />
      <View style={styles.managed}>
        {offer && (
          <View style={styles.panel} accessible>
            <OrgTile name={SAMPLE.organisation} size="card" />
            <View style={styles.words}>
              <Text size={tokens.typeRowTitle.size} weight="semibold">
                {`${SAMPLE.organisation} uses Soirely`}
              </Text>
              <Text size={tokens.typeSmall.size} muted>
                Somebody there approves you before you see anything.
              </Text>
            </View>
          </View>
        )}
        <ManagedBanner way={step.way} testID="organisation.managed" />
      </View>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: tokens.space3xl },
  next: { marginTop: tokens.spaceXxl },
  managed: { marginTop: tokens.space3xl, gap: tokens.spaceXl },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    padding: tokens.spaceXl,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
  },
  words: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
});
