import { emailProblem } from '@soirely/domain';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, TextField } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { Footnote, Note } from './AccountParts.tsx';
import { TaskPage } from './Frame.tsx';
import { Pill } from './parts.tsx';

const EMAIL_LABEL = 'Email';

/** Forgot password, from Change password's Forgot it?: the email, then the sent state. */
export function ForgotTask({ sent: startSent, onBack }: { sent: boolean; onBack: () => void }) {
  const [sent, setSent] = useState(startSent);
  const typed = useRef<string>(SAMPLE.email);
  const [error, setError] = useState<string | null>(null);
  const back = { label: 'Security', onPress: onBack };

  function send(): void {
    const problem = emailProblem(typed.current);
    if (problem == null) {
      setSent(true);
      return;
    }
    setError(
      problem === 'blank'
        ? 'Enter your email address.'
        : 'That does not look like an email address. Check it has an @ and a domain.',
    );
  }

  if (sent)
    return (
      <TaskPage
        back={back}
        title="Check your email"
        sub="If that address has an account, we have sent it a link to set a new password. The link works once."
      >
        <Notice
          tone="quiet"
          mark="i"
          title="Nothing there?"
          body="Check your spam folder first, then send it again."
        />
        <Pill
          label="Send it again"
          kind="secondary"
          onPress={() => {
            typed.current = SAMPLE.email;
            setSent(false);
          }}
        />
        <Note text="Signed up with Google or Apple? Then there is no password to reset, and the email says how you sign in instead." />
        <View style={styles.foot}>
          <Footnote
            text="Got the link? Open it on any device."
            link="Back to sign in"
            onPress={onBack}
          />
        </View>
      </TaskPage>
    );

  return (
    <TaskPage
      back={back}
      title="Reset your password"
      sub="Enter the email you sign in with. If it has an account, we send it a link to set a new password."
    >
      <Field label={EMAIL_LABEL} error={error}>
        <TextField
          defaultValue={SAMPLE.email}
          wrong={error != null}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onChangeText={(text) => {
            typed.current = text;
            if (error != null) setError(null);
          }}
          onSubmitEditing={send}
          submitBehavior="submit"
          accessibilityLabel={EMAIL_LABEL}
          testID="demo.security.forgotEmail"
        />
      </Field>
      <Pill label="Send the link" onPress={send} testID="demo.security.sendLink" />
      <View style={styles.foot}>
        <Footnote text="Remembered it?" link="Sign in" onPress={onBack} />
      </View>
    </TaskPage>
  );
}

const styles = StyleSheet.create({
  foot: { paddingTop: tokens.spaceXl },
});
