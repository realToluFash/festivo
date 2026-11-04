import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen, NavBar } from '../../../src/demo/DemoScreen.tsx';
import { InsideField } from '../../../src/steps/InsideField.tsx';
import { Heading, Says } from '../../../src/steps/Lines.tsx';
import { emailLooksRight } from '../../../src/steps/rules.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** Forgot your password? brings the email typed on sign-in. */
export default function ResetPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<TextInputInstance>(null);

  function send(): void {
    if (busy) return;
    if (email.trim() === '') return refuse('Enter your email address.');
    if (!emailLooksRight(email)) return refuse('Enter an email address like name@example.com.');
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      router.push({ pathname: '/demo/link-sent', params: { email: email.trim() } });
    }, 600);
  }

  function refuse(words: string): void {
    setSaid(words);
    field.current?.focus();
  }

  return (
    <DemoScreen
      nav={<NavBar />}
      foot={
        <PrimaryButton
          label={busy ? 'Sending…' : 'Send the link'}
          busy={busy}
          onPress={send}
          testID="demo.sendLink"
        />
      }
    >
      <Heading title="Reset your password" intro="We email you a link to set a new one." />
      <View style={styles.first}>
        <InsideField
          ref={field}
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setSaid(null);
          }}
          state={said != null ? 'blank' : 'plain'}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={send}
          autoFocus={params.email == null || params.email === ''}
          testID="demo.email"
        />
        {said != null && <Says words={said} />}
      </View>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: tokens.space3xl },
});
