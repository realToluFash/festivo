import { formatCountdown } from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CodeError } from '../kit/accountPage.ts';
import { tokens } from '../theme/tokens.ts';
import {
  CodeField,
  Field,
  FieldError,
  focusChecked,
  focusRefused,
  keysStayDown,
} from './Field.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { FocusedScreen, Line, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

export const CODE_FIGURES = { fontVariant: ['tabular-nums' as const], letterSpacing: 1.5 };

/** A spent code takes the field's place until a new one is sent. */
export function CodeExpired({ title, line }: { title: string; line: string }) {
  return (
    <View style={styles.expired}>
      <Text size={16} weight="semibold">
        {title}
      </Text>
      <Line text={line} />
    </View>
  );
}

/** Why a code was not taken: `checked` when the client found it before sending. */
export interface CodeSays {
  error: CodeError;
  checked: boolean;
}

/** Check your email or your messages: the code, a new one after the wait, and a number on WhatsApp may take a text. */
export function VerifyScreen({
  open,
  title,
  lead,
  codeLabel,
  errors,
  spent,
  wait,
  prefill = '',
  startError = null,
  autoFocus = true,
  opener,
  onClose,
  onVerify,
  onResend,
  onTextInstead,
  note = null,
}: {
  open: boolean;
  title: string;
  lead: string;
  codeLabel: string;
  /** Each error in the words of the way the code goes now, so a handover to a text rewords it. */
  errors: Record<CodeError, string>;
  /** Expired or out of tries: its words, in the field's place. */
  spent: { title: string; line: string } | null;
  /** Seconds until a new code may be sent. */
  wait: number;
  prefill?: string;
  startError?: CodeError | null;
  autoFocus?: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  /** Resolves to why the code was not taken, or null once it is. */
  onVerify: (code: string) => Promise<CodeSays | null>;
  onResend: () => Promise<boolean>;
  /** Offered while the code went by WhatsApp. */
  onTextInstead: (() => Promise<void>) | null;
  /** Why the last step went nowhere, as a text that could not be sent. */
  note?: string | null;
}) {
  const { t } = useTranslation();
  const [sent, setSent] = useState(0);
  const [error, setError] = useState<CodeError | null>(startError);
  const [verifying, setVerifying] = useState(false);
  const code = useRef(prefill);
  const field = useRef<TextInputInstance>(null);

  async function verify(): Promise<void> {
    if (verifying) return;
    keysStayDown();
    setVerifying(true);
    const says = await onVerify(code.current);
    setVerifying(false);
    if (says == null) return;
    setError(says.error);
    if (says.checked) focusChecked(field);
    else focusRefused(field);
  }

  async function sendAgain(): Promise<void> {
    setError(null);
    if (!(await onResend())) return;
    code.current = '';
    setSent((count) => count + 1);
  }

  return (
    <FocusedScreen
      open={open}
      title={title}
      verb={{
        label: t('account.verify'),
        on: spent == null,
        busy: verifying,
        onPress: () => void verify(),
        testID: 'account.verify.submit',
      }}
      waits={verifying}
      onCancel={onClose}
      cancelTestID="account.verify.cancel"
      opener={opener}
      testID="account.verify.screen"
    >
      <Line text={lead} />
      {spent != null ? (
        <CodeExpired title={spent.title} line={spent.line} />
      ) : (
        <View style={styles.field}>
          <Field label={codeLabel} error={error && errors[error]}>
            <CodeField
              key={sent}
              ref={field}
              defaultValue={sent === 0 ? prefill : ''}
              wrong={error != null}
              submitting={verifying}
              autoFocus={autoFocus || sent > 0}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="done"
              onChangeText={(text) => {
                code.current = text;
                if (error != null) setError(null);
              }}
              onSubmitEditing={() => void verify()}
              submitBehavior="submit"
              accessibilityLabel={codeLabel}
              testID="account.verify.code"
            />
          </Field>
        </View>
      )}
      <TextAction
        label={
          wait > 0
            ? t('verifyEmail.resendIn', { time: formatCountdown(wait) })
            : t('verifyEmail.resend')
        }
        off={wait > 0}
        figures
        onPress={() => void sendAgain()}
        consequence={t('verifyEmail.resendNote')}
        testID="account.verify.resend"
      />
      {onTextInstead != null && spent == null && (
        <TextAction
          label={t('verifyPhone.textInstead')}
          onPress={() => void onTextInstead()}
          testID="account.verify.text"
        />
      )}
      {note != null && <FieldError message={note} />}
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  field: { paddingTop: tokens.spaceXs },
  expired: { gap: tokens.spaceXxs, paddingTop: tokens.spaceXs },
});
