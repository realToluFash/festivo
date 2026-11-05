import { type RefObject, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import { CodeField, Field, focusChecked, focusRefused } from '../../components/Field.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { CODE_SAYS, type ConfirmSays, confirmSays, PASSWORD_SAYS, WORDS } from './AccountModel.ts';
import { Lead, Note, StepPill, SubHead } from './AccountParts.tsx';
import { passwordProblem, secondFactorProblem } from './AccountSample.ts';
import { Pair } from './parts.tsx';
import type { SettingsLayout } from './sample.ts';
import { FocusedScreen, Line } from './Summary.tsx';

const PASSWORD_LABEL = 'Your password';
const CODE_LABEL = 'Code';

const CODE_HELP = 'From your authenticator app, or one of your recovery codes.';

/** Confirm it's you before the address you sign in with changes: Cancel · Confirm it's you · Continue. */
export function ConfirmScreen({
  open,
  opener,
  onClose,
  onProved,
}: {
  open: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onProved: () => void;
}) {
  const password = useRef('');
  const code = useRef('');
  const passwordField = useRef<TextInputInstance>(null);
  const codeField = useRef<TextInputInstance>(null);
  const [says, setSays] = useState<ConfirmSays>({
    password: null,
    code: null,
    checked: false,
  });

  function proceed(): void {
    const next = confirmSays(password.current, code.current);
    setSays(next);
    const field = next.password != null ? passwordField : next.code != null ? codeField : null;
    if (field == null) {
      onProved();
      return;
    }
    if (next.checked) focusChecked(field);
    else focusRefused(field);
  }

  return (
    <FocusedScreen
      open={open}
      title={WORDS.confirmTitle}
      verb={{
        label: WORDS.continue,
        on: true,
        onPress: proceed,
        testID: 'account.confirm.continue',
      }}
      onCancel={onClose}
      cancelTestID="account.confirm.cancel"
      opener={opener}
      testID="account.confirm.screen"
    >
      <Line text={WORDS.confirmLead} />
      <Field label={PASSWORD_LABEL} error={says.password}>
        <PasswordField
          ref={passwordField}
          wrong={says.password != null}
          autoFocus
          autoComplete="current-password"
          textContentType="password"
          onChangeText={(text) => {
            password.current = text;
            if (says.password != null) setSays({ ...says, password: null });
          }}
          returnKeyType="next"
          onSubmitEditing={() => codeField.current?.focus()}
          submitBehavior="submit"
          accessibilityLabel={PASSWORD_LABEL}
          testID="account.confirm.password"
        />
      </Field>
      <Field label={CODE_LABEL} error={says.code} help={CODE_HELP}>
        <CodeField
          ref={codeField}
          takesRecoveryCode
          wrong={says.code != null}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          onChangeText={(text) => {
            code.current = text;
            if (says.code != null) setSays({ ...says, code: null });
          }}
          returnKeyType="done"
          onSubmitEditing={proceed}
          submitBehavior="submit"
          accessibilityLabel={CODE_LABEL}
          testID="account.confirm.code"
        />
      </Field>
    </FocusedScreen>
  );
}

/** Confirm it's you: the password, then the second factor, before a change to how you sign in. */
export function ConfirmItsYou({
  layout,
  intro,
  note,
  twoFactorOn = true,
  onProved,
  onCancel,
  testID,
}: {
  layout: SettingsLayout;
  intro: string;
  note?: string | undefined;
  twoFactorOn?: boolean;
  onProved: () => void;
  onCancel: () => void;
  testID: string;
}) {
  const password = useRef('');
  const code = useRef('');
  const [errors, setErrors] = useState<{ password: string | null; code: string | null }>({
    password: null,
    code: null,
  });

  function submit(): void {
    const wrongPassword = passwordProblem(password.current);
    const wrongCode = twoFactorOn ? secondFactorProblem(code.current) : null;

    if (wrongPassword == null && wrongCode == null) {
      onProved();
      return;
    }
    setErrors({
      password: wrongPassword == null ? null : PASSWORD_SAYS[wrongPassword],
      code: wrongCode == null ? null : CODE_SAYS[wrongCode],
    });
  }

  return (
    <>
      <SubHead text="Confirm it's you" />
      <Lead text={intro} />
      <Field label={PASSWORD_LABEL} error={errors.password}>
        <PasswordField
          wrong={errors.password != null}
          autoComplete="current-password"
          textContentType="password"
          onChangeText={(text) => {
            password.current = text;
            if (errors.password != null) setErrors({ ...errors, password: null });
          }}
          returnKeyType={twoFactorOn ? 'next' : 'done'}
          onSubmitEditing={twoFactorOn ? undefined : submit}
          submitBehavior={twoFactorOn ? 'blurAndSubmit' : 'submit'}
          accessibilityLabel={PASSWORD_LABEL}
          testID={`${testID}.password`}
        />
      </Field>
      {twoFactorOn && (
        <Field label={CODE_LABEL} error={errors.code} help={CODE_HELP}>
          <CodeField
            takesRecoveryCode
            wrong={errors.code != null}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            onChangeText={(text) => {
              code.current = text;
              if (errors.code != null) setErrors({ ...errors, code: null });
            }}
            returnKeyType="done"
            onSubmitEditing={submit}
            submitBehavior="submit"
            accessibilityLabel={CODE_LABEL}
            testID={`${testID}.secondFactor`}
          />
        </Field>
      )}
      {note != null && <Note text={note} />}
      <Pair
        layout={layout}
        dismiss={<StepPill layout={layout} label="Cancel" kind="secondary" onPress={onCancel} />}
        confirm={<StepPill layout={layout} label="Continue" onPress={submit} />}
      />
    </>
  );
}
