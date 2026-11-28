import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton, QuietButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen, NavBar, finish } from '../../../src/demo/DemoScreen.tsx';
import { SAMPLE } from '../../../src/demo/samples.ts';
import {
  APP_ON,
  codeInstead,
  PASSKEY_REFUSED,
  samplePasskeys,
  waitingWords,
} from '../../../src/demo/settings/PasskeysModel.ts';
import { Waiting } from '../../../src/demo/settings/SecurityPasskeys.tsx';
import { DemoOnly, Heading, Says } from '../../../src/steps/Lines.tsx';
import { tokens } from '../../../src/theme/tokens.ts';

/** The step after the first factor for a member with a passkey: the system's sheet over a waiting state. */
export default function PasskeyStep() {
  const params = useLocalSearchParams<{
    email?: string;
    only?: string;
    step?: string;
    sheet?: string;
    refused?: string;
  }>();
  const email = params.email ?? SAMPLE.email;
  const step = params.step === 'reset' ? 'reset' : 'signIn';
  const factors = { app: params.only === '1' ? null : APP_ON, passkeys: samplePasskeys(2) };
  const [sheet, setSheet] = useState(params.sheet !== 'closed' && params.refused !== '1');
  const [refused, setRefused] = useState(params.refused === '1');
  const words = waitingWords(step, email);

  function accepted(): void {
    setSheet(false);
    if (step === 'reset') router.push({ pathname: '/demo/new-password', params: { email } });
    else finish();
  }

  function instead(): void {
    router.push({
      pathname: codeInstead(factors) === 'code' ? '/demo/two-factor' : '/demo/recovery',
      params: { email },
    });
  }

  return (
    <DemoScreen
      nav={<NavBar />}
      foot={
        <>
          <PrimaryButton
            label="Use a passkey"
            off={sheet}
            onPress={() => {
              setRefused(false);
              setSheet(true);
            }}
            testID="demo.passkey"
          />
          <QuietButton label="Use a code instead" onPress={instead} testID="demo.codeInstead" />
        </>
      }
    >
      <Heading title={words.title} intro={words.intro} />
      <View style={styles.state}>
        {sheet && <Waiting />}
        {refused && <Says words={PASSKEY_REFUSED} />}
      </View>
      {sheet && (
        <DemoOnly title="Demo: in the build, the system’s own passkey sheet opens here (iOS’s on iPhone and iPad, Credential Manager on Android). Answer it as the sheet would.">
          <QuietButton label="Use the passkey" onPress={accepted} testID="demo.sheet.use" />
          <QuietButton
            label="A passkey the server refuses"
            onPress={() => {
              setSheet(false);
              setRefused(true);
            }}
            testID="demo.sheet.refused"
          />
          <QuietButton
            label="Cancel the sheet"
            onPress={() => setSheet(false)}
            testID="demo.sheet.cancel"
          />
        </DemoOnly>
      )}
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  state: { marginTop: tokens.space3xl, minHeight: 44 },
});
