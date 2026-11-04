import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { PrimaryButton } from '../../../src/components/Buttons.tsx';
import { DemoScreen, NavBar, finish } from '../../../src/demo/DemoScreen.tsx';
import { FieldLine, InsideField } from '../../../src/steps/InsideField.tsx';
import { Heading, Plain } from '../../../src/steps/Lines.tsx';
import { passwordLongEnough } from '../../../src/steps/rules.ts';
import { SAMPLE } from '../../../src/demo/samples.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** Opened from the link in the email: Close, the same hint line, and what it does to other devices. */
export default function NewPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [password, setPassword] = useState('');
  const [short, setShort] = useState(false);
  const [busy, setBusy] = useState(false);
  const field = useRef<TextInputInstance>(null);
  const long = passwordLongEnough(password);

  function save(): void {
    if (busy) return;
    if (!long) {
      setShort(true);
      field.current?.focus();
      return;
    }
    setBusy(true);
    setTimeout(() => finish('Password changed. Your other devices are signed out.'), 700);
  }

  return (
    <DemoScreen
      nav={<NavBar left="close" />}
      foot={
        <PrimaryButton
          label={busy ? 'Saving…' : 'Set password and sign in'}
          busy={busy}
          onPress={save}
          testID="demo.save"
        />
      }
    >
      <Heading title="Set a new password" intro={`For ${params.email ?? SAMPLE.email}.`} />
      <View style={styles.first}>
        <InsideField
          ref={field}
          label="New password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setShort(false);
          }}
          password
          state={short ? 'blank' : 'plain'}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          submitBehavior="submit"
          onSubmitEditing={save}
          autoFocus
          testID="demo.newPassword"
        />
        <FieldLine words="At least 15 characters" tone={long ? 'met' : short ? 'wrong' : 'unmet'} />
      </View>
      <Plain top={tokens.spaceXl}>This signs you out on your other devices.</Plain>
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: tokens.space3xl },
});
