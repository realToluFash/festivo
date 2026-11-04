import { useRef, useState } from 'react';

import { CodeField, Field } from '../../components/Field.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import { passwordProblem, secondFactorProblem } from './AccountSample.ts';
import { Lead, Note, StepPill, SubHead } from './AccountParts.tsx';
import { Pair } from './parts.tsx';
import type { SettingsLayout } from './sample.ts';

const PASSWORD_LABEL = 'Your password';
const CODE_LABEL = 'Code';

const PASSWORD_SAYS = {
  blank: 'Enter your password.',
  wrong: 'That is not your password. Try again, or reset it by email.',
} as const;

const CODE_SAYS = {
  blank: 'Enter a code from your app, or a recovery code.',
  wrong: 'That code did not work. Check your app and try again.',
} as const;

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
        <Field
          label={CODE_LABEL}
          error={errors.code}
          help="From your authenticator app, or one of your recovery codes."
        >
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
