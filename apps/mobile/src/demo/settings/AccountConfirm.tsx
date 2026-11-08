import { type RefObject, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import { CodeField, Field, focusChecked, focusRefused } from '../../components/Field.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import {
  ACCOUNT_PROOF,
  type ConfirmSays,
  confirmSays,
  type ProofAsks,
  WORDS,
} from './AccountModel.ts';
import { FocusedScreen, Line } from '../../components/Summary.tsx';

const PASSWORD_LABEL = 'Your password';
const CODE_LABEL = 'Code';

/** Confirm it's you before a change to how you sign in: Cancel · Confirm it's you · Continue. */
export function ConfirmScreen({
  open,
  asks = ACCOUNT_PROOF,
  opener,
  onClose,
  onProved,
  testID = 'account.confirm',
}: {
  open: boolean;
  asks?: ProofAsks;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onProved: () => void;
  testID?: string;
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
    if (asks.instead != null) {
      onProved();
      return;
    }
    const next = confirmSays(password.current, code.current, asks);
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
      verb={{ label: WORDS.continue, on: true, onPress: proceed, testID: `${testID}.continue` }}
      onCancel={onClose}
      cancelTestID={`${testID}.cancel`}
      opener={opener}
      testID={`${testID}.screen`}
    >
      <Line text={asks.lead} />
      {asks.note != null && <Line size={14} text={asks.note} />}
      {asks.password && (
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
            returnKeyType={asks.code ? 'next' : 'done'}
            onSubmitEditing={() => (asks.code ? codeField.current?.focus() : proceed())}
            submitBehavior="submit"
            accessibilityLabel={PASSWORD_LABEL}
            testID={`${testID}.password`}
          />
        </Field>
      )}
      {asks.code && (
        <Field label={CODE_LABEL} error={says.code} help={asks.codeHelp}>
          <CodeField
            ref={codeField}
            takesRecoveryCode
            wrong={says.code != null}
            autoFocus={!asks.password}
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
            testID={`${testID}.code`}
          />
        </Field>
      )}
    </FocusedScreen>
  );
}
