import { meetsPasswordLength, PASSWORD_MINIMUM_LENGTH } from '@soirely/domain';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CodeField, Field } from '../../components/Field.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { Note, Resend, StateMark, StepPill, useCountdown, WhiteBox } from './AccountParts.tsx';
import { sentCodeProblem } from './AccountSample.ts';
import { Card, CardHead, Pair } from './parts.tsx';
import type { SettingsLayout } from './sample.ts';

const CURRENT_LABEL = 'Current password';
const NEW_LABEL = 'New password';
const CHOSEN_LABEL = 'Password';
const CODE_LABEL = 'Code from the email';

function RuleInset({ met }: { met: boolean }) {
  return (
    <WhiteBox gap={tokens.spaceSm}>
      <Text size={14} weight="semibold">
        Your password
      </Text>
      <View style={styles.rule}>
        <Text size={15} weight="medium" style={styles.grow}>
          {`At least ${PASSWORD_MINIMUM_LENGTH} characters`}
        </Text>
        <StateMark on={met} word={met ? 'Met' : 'Not yet'} />
      </View>
      <Note text="That is the only rule. When you submit, we also check the password has not appeared in a known data breach." />
    </WhiteBox>
  );
}

export function ChangePassword({
  layout,
  onForgot,
  onCancel,
  onSaved,
}: {
  layout: SettingsLayout;
  onForgot: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const current = useRef('');
  const next = useRef('');
  const [met, setMet] = useState(false);
  const [errors, setErrors] = useState<{ current: string | null; next: string | null }>({
    current: null,
    next: null,
  });

  function save(): void {
    const blank = {
      current: current.current === '' ? 'Enter your current password.' : null,
      next: next.current === '' ? 'Enter a new password.' : null,
    };
    if (blank.current != null || blank.next != null) {
      setErrors(blank);
      return;
    }
    if (current.current !== SAMPLE.password) {
      setErrors({
        current: 'That is not your current password. Try again, or reset it by email.',
        next: null,
      });
      return;
    }
    if (next.current === current.current) {
      setErrors({ current: null, next: 'That is already your password. Choose a different one.' });
      return;
    }
    if (meetsPasswordLength(next.current)) onSaved();
  }

  return (
    <Card>
      <CardHead title="Change your password" />
      <Field
        label={CURRENT_LABEL}
        labelAction={{ label: 'Forgot it?', onPress: onForgot, testID: 'demo.security.forgot' }}
        error={errors.current}
      >
        <PasswordField
          wrong={errors.current != null}
          autoFocus
          autoComplete="current-password"
          textContentType="password"
          onChangeText={(text) => {
            current.current = text;
            if (errors.current != null) setErrors({ ...errors, current: null });
          }}
          returnKeyType="next"
          submitBehavior="blurAndSubmit"
          accessibilityLabel={CURRENT_LABEL}
          testID="demo.security.currentPassword"
        />
      </Field>
      <Field label={NEW_LABEL} error={errors.next}>
        <PasswordField
          wrong={errors.next != null}
          autoComplete="new-password"
          textContentType="newPassword"
          onChangeText={(text) => {
            next.current = text;
            setMet(meetsPasswordLength(text));
            if (errors.next != null) setErrors({ ...errors, next: null });
          }}
          returnKeyType="done"
          onSubmitEditing={save}
          submitBehavior="submit"
          accessibilityLabel={NEW_LABEL}
          testID="demo.security.newPassword"
        />
      </Field>
      <RuleInset met={met} />
      <View style={styles.notes}>
        <Note text="Saving signs out your other devices; this one stays signed in." />
        <Note text={`We will email ${SAMPLE.email} to say it was changed.`} />
      </View>
      <Pair
        layout={layout}
        dismiss={<StepPill layout={layout} label="Cancel" kind="secondary" onPress={onCancel} />}
        confirm={<StepPill layout={layout} label="Save new password" onPress={save} />}
      />
    </Card>
  );
}

/** Set a password, for somebody who signs in with Google or Apple: a code by email, then the password. */
export function SetPassword({
  layout,
  onCancel,
  onSaved,
}: {
  layout: SettingsLayout;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<'code' | 'choose'>('code');
  const code = useRef('');
  const chosen = useRef('');
  const [met, setMet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countdown = useCountdown(42);

  function checkCode(): void {
    const problem = sentCodeProblem(code.current);
    if (problem == null) {
      setError(null);
      setStep('choose');
      return;
    }
    setError(
      {
        blank: 'Enter the 6-digit code from the email.',
        short: 'The code is 6 digits.',
        wrong: 'That code did not match. Check the newest email from Soirely and try again.',
      }[problem],
    );
  }

  function save(): void {
    if (chosen.current === '') {
      setError('Enter a password.');
      return;
    }
    if (meetsPasswordLength(chosen.current)) onSaved();
  }

  if (step === 'code')
    return (
      <Card>
        <CardHead
          title="Check your email"
          line={`We sent a 6-digit code to ${SAMPLE.email} to make sure it's you.`}
        />
        <Field label={CODE_LABEL} error={error}>
          <CodeField
            wrong={error != null}
            autoFocus
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            onChangeText={(text) => {
              code.current = text;
              if (error != null) setError(null);
            }}
            onSubmitEditing={checkCode}
            submitBehavior="submit"
            accessibilityLabel={CODE_LABEL}
            testID="demo.security.setCode"
          />
        </Field>
        <Note text="Adding a password needs this, so someone using this device without you can't add one." />
        <View style={styles.stack}>
          <StepPill layout={layout} label="Continue" onPress={checkCode} />
          <Resend
            layout={layout}
            left={countdown.left}
            onSend={countdown.restart}
            testID="demo.security.setResend"
          />
          <StepPill layout={layout} label="Cancel" kind="quiet" onPress={onCancel} />
        </View>
      </Card>
    );

  return (
    <Card>
      <CardHead title="Choose a password" />
      <Field label={CHOSEN_LABEL} error={error}>
        <PasswordField
          wrong={error != null}
          autoFocus
          autoComplete="new-password"
          textContentType="newPassword"
          onChangeText={(text) => {
            chosen.current = text;
            setMet(meetsPasswordLength(text));
            if (error != null) setError(null);
          }}
          returnKeyType="done"
          onSubmitEditing={save}
          submitBehavior="submit"
          accessibilityLabel={CHOSEN_LABEL}
          testID="demo.security.choosePassword"
        />
      </Field>
      <RuleInset met={met} />
      <Note text={`We will email ${SAMPLE.email} to say a password was added.`} />
      <Pair
        layout={layout}
        dismiss={<StepPill layout={layout} label="Cancel" kind="secondary" onPress={onCancel} />}
        confirm={<StepPill layout={layout} label="Save password" onPress={save} />}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  rule: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  grow: { flex: 1, minWidth: 0 },
  notes: { gap: tokens.spaceXs },
  stack: { gap: tokens.spaceMd },
});
