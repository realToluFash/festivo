import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, StyleSheet, type TextInputInstance, View } from 'react-native';

import { PrimaryButton, QuietButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen, NavBar, finish, goBack } from '../../../src/demo/DemoScreen.tsx';
import { tap } from '../../../src/steps/haptics.ts';
import { InsideField } from '../../../src/steps/InsideField.tsx';
import { Heading, Plain, Says } from '../../../src/steps/Lines.tsx';
import { recoveryComplete, shapeRecovery } from '../../../src/steps/rules.ts';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { useShake } from '../../../src/steps/shake.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** A recovery code typed as it was printed: capitals or not, the dash put in as it goes. */
export default function RecoveryCode() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [said, setSaid] = useState<{ words: string; blank: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<TextInputInstance>(null);
  const { shaken, shake } = useShake();

  function use(): void {
    if (busy) return;
    if (!recoveryComplete(code)) {
      setSaid({ words: 'Enter all 8 characters, like vtxp-rh7y.', blank: true });
      field.current?.focus();
      return;
    }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      if (code !== SAMPLE.recovery) {
        tap.wrong();
        shake();
        setSaid({
          words: 'That code is not one of your recovery codes, or it has been used.',
          blank: false,
        });
        field.current?.focus();
        field.current?.setSelection(0, code.length);
        return;
      }
      tap.done();
      finish();
    }, 600);
  }

  return (
    <DemoScreen
      nav={<NavBar />}
      foot={
        <PrimaryButton
          label={busy ? 'Checking…' : 'Use this code'}
          busy={busy}
          onPress={use}
          testID="demo.use"
        />
      }
    >
      <Heading
        title="Enter a recovery code"
        intro="One of the codes you saved when you turned on two-factor. Each works once."
      />
      <Animated.View style={[styles.first, shaken]}>
        <InsideField
          ref={field}
          label="Recovery code"
          value={code}
          onChangeText={(text) => {
            setCode(shapeRecovery(text));
            setSaid(null);
          }}
          state={said?.blank === true ? 'blank' : 'plain'}
          autoCapitalize="none"
          autoComplete="off"
          maxLength={9}
          returnKeyType="go"
          submitBehavior="submit"
          onSubmitEditing={use}
          autoFocus
          testID="demo.recoveryCode"
        />
      </Animated.View>
      {said != null ? (
        <Says words={said.words} />
      ) : (
        <Plain>Like vtxp-rh7y. Capitals or not; the dash goes in by itself.</Plain>
      )}
      <View style={styles.ways}>
        <QuietButton
          label="Use your authenticator app instead"
          onPress={goBack}
          testID="demo.authenticator"
        />
        <QuietButton
          label="Lost your authenticator and your recovery codes?"
          onPress={() =>
            router.push({ pathname: '/demo/lost', params: { email: email ?? SAMPLE.email } })
          }
          testID="demo.lost"
        />
      </View>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: tokens.space3xl },
  ways: { marginTop: tokens.spaceLg, alignItems: 'flex-start' },
});
