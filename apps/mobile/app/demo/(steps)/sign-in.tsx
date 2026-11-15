import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, StyleSheet, type TextInputInstance, View } from 'react-native';

import { PrimaryButton, QuietButton } from '../../../src/components/Buttons.tsx';
import { withBoldText } from '../../../src/demo/boldText/BoldTextSwitch.tsx';
import { DemoScreen, NavBar, goBack, useInSheet } from '../../../src/demo/DemoScreen.tsx';
import { tap } from '../../../src/steps/haptics.ts';
import { type FieldState, InsideField } from '../../../src/steps/InsideField.tsx';
import { Heading, Says } from '../../../src/steps/Lines.tsx';
import { emailLooksRight } from '../../../src/steps/rules.ts';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { useShake } from '../../../src/steps/shake.ts';
import { tokens } from '../../../src/theme/tokens.ts';

type Wrong = { field: 'email' | 'password'; state: FieldState | 'refused'; words: string } | null;

function SignIn() {
  const params = useLocalSearchParams<{
    email?: string;
    password?: string;
    after?: string;
    timedOut?: string;
  }>();
  const inSheet = useInSheet();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState(params.password ?? '');
  const [wrong, setWrong] = useState<Wrong>(null);
  const [busy, setBusy] = useState(false);
  const emailField = useRef<TextInputInstance>(null);
  const passwordField = useRef<TextInputInstance>(null);
  const { shaken, shake } = useShake();

  function refuse(next: NonNullable<Wrong>): void {
    setWrong(next);
    (next.field === 'email' ? emailField : passwordField).current?.focus();
  }

  function signIn(): void {
    if (busy) return;
    if (email.trim() === '')
      return refuse({ field: 'email', state: 'blank', words: 'Enter your email address.' });
    if (!emailLooksRight(email))
      return refuse({
        field: 'email',
        state: 'blank',
        words: 'Enter an email address like name@example.com.',
      });
    if (password === '')
      return refuse({ field: 'password', state: 'blank', words: 'Enter your password.' });
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      if (email.trim().toLowerCase() !== SAMPLE.email || password !== SAMPLE.password) {
        tap.wrong();
        setWrong({
          field: 'password',
          state: 'refused',
          words: 'That email and password do not match.',
        });
        shake();
        passwordField.current?.focus();
        passwordField.current?.setSelection(0, password.length);
        return;
      }
      tap.done();
      if (params.after === 'tfaAgain') router.replace('/demo/tfa-again');
      else if (params.after === 'join') router.replace('/demo/join-message');
      else router.push({ pathname: '/demo/two-factor', params: { email: email.trim() } });
    }, 600);
  }

  return (
    <DemoScreen
      nav={<NavBar left={inSheet ? { label: 'Cancel', onPress: goBack } : 'back'} />}
      foot={
        <PrimaryButton
          label={busy ? 'Signing in…' : 'Sign in'}
          busy={busy}
          onPress={signIn}
          testID="demo.signIn"
        />
      }
    >
      <Heading title="Sign in" />
      {params.timedOut != null && (
        <Says words="That sign-in timed out. Sign in again to carry on." quiet />
      )}
      <Animated.View style={[styles.first, shaken]}>
        <InsideField
          ref={emailField}
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (wrong != null) setWrong(null);
          }}
          state={wrong?.field === 'email' && wrong.state === 'blank' ? 'blank' : 'plain'}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordField.current?.focus()}
          autoFocus={params.email == null}
          testID="demo.email"
        />
        {wrong?.field === 'email' && <Says words={wrong.words} />}
      </Animated.View>
      <Animated.View style={[styles.next, shaken]}>
        <InsideField
          ref={passwordField}
          label="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (wrong != null) setWrong(null);
          }}
          password
          state={wrong?.field === 'password' && wrong.state === 'blank' ? 'blank' : 'plain'}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          submitBehavior="submit"
          onSubmitEditing={signIn}
          autoFocus={params.email != null}
          testID="demo.password"
        />
      </Animated.View>
      {wrong?.field === 'password' && <Says words={wrong.words} />}
      <View style={styles.forgot}>
        <QuietButton
          label="Forgot your password?"
          onPress={() => router.push({ pathname: '/demo/reset', params: { email: email.trim() } })}
          testID="demo.forgot"
        />
      </View>
    </DemoScreen>
  );
}

export default withBoldText(SignIn);

const styles = StyleSheet.create({
  first: { marginTop: tokens.space3xl },
  next: { marginTop: tokens.spaceXl },
  forgot: { marginTop: tokens.spaceSm, alignItems: 'flex-start' },
});
