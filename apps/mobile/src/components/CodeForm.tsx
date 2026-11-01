import { formatCountdown } from '@soirely/domain';
import { type ReactNode, type RefObject, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { type CodeStatus, asksForCode } from '../kit/code.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton } from './Buttons.tsx';
import { CodeField, Field } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { useFocusOnAnswer } from './Screen.tsx';
import { Text } from './Text.tsx';

/** The code screens' form, an email's and a phone's: `copy` names whose words it speaks in. */
export function CodeForm({
  copy,
  status,
  cooldown,
  error,
  onTyped,
  onLeft,
  onVerify,
  onResend,
  inputRef,
  codeLabel,
  children,
}: {
  copy: 'verifyEmail' | 'verifyPhone';
  /** In place of the copy's own, as a phone code from WhatsApp is labelled. */
  codeLabel?: string | undefined;
  status: CodeStatus;
  cooldown: number;
  error: string | null;
  onTyped: (code: string) => void;
  onLeft: (code: string) => void;
  onVerify: (code: string) => void;
  onResend: () => void;
  inputRef?: RefObject<TextInputInstance | null> | undefined;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const typed = useRef('');
  const verifying = status.kind === 'verifying';
  const answer = 'opened' in status ? undefined : status;
  const ownInput = useRef<TextInputInstance>(null);
  const input = inputRef ?? ownInput;
  // Send a new code in the code's place brings the field back, or a failure, in its place (sc-11173).
  const [resentInPlace, setResentInPlace] = useState<object | undefined>(undefined);
  useFocusOnAnswer<TextInputInstance>(
    status.kind === 'entering' ? resentInPlace : undefined,
    input,
  );

  return (
    <View style={styles.form}>
      {status.kind === 'expired' && (
        <Notice
          tone="attention"
          mark="!"
          title={t(`${copy}.expiredTitle`)}
          body={t(`${copy}.expiredBody`)}
          answer={answer}
          takesFocus
        />
      )}

      {status.kind === 'exhausted' && (
        <Notice
          tone="attention"
          mark="!"
          title={t(`${copy}.exhaustedTitle`)}
          body={t(`${copy}.exhaustedBody`)}
          answer={answer}
          takesFocus
        />
      )}

      {status.kind === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t(`${copy}.failedTitle`)}
          body={t(`${copy}.failedBody`)}
          answer={answer}
          takesFocus={resentInPlace != null}
        />
      )}

      {!asksForCode(status) && (
        <PrimaryButton
          label={t(`${copy}.resend`)}
          onPress={() => {
            setResentInPlace({});
            onResend();
          }}
          testID={`${copy}.resend`}
        />
      )}

      {asksForCode(status) && (
        <>
          <Field label={codeLabel ?? t(`${copy}.codeLabel`)} error={error}>
            <CodeField
              ref={input}
              wrong={error != null}
              submitting={verifying}
              returnKeyType="done"
              onChangeText={(text) => {
                typed.current = text;
                setResentInPlace(undefined);
                onTyped(text);
              }}
              onBlur={() => onLeft(typed.current)}
              onSubmitEditing={() => {
                if (!verifying) onVerify(typed.current);
              }}
              submitBehavior="submit"
              accessibilityLabel={codeLabel ?? t(`${copy}.codeLabel`)}
              testID={`${copy}.code`}
            />
          </Field>

          <PrimaryButton
            label={verifying ? t(`${copy}.submitting`) : t(`${copy}.submit`)}
            onPress={() => {
              setResentInPlace(undefined);
              onVerify(typed.current);
            }}
            busy={verifying}
            testID={`${copy}.submit`}
          />

          <View style={styles.resend}>
            <QuietButton
              label={
                cooldown > 0
                  ? t(`${copy}.resendIn`, { time: formatCountdown(cooldown) })
                  : t(`${copy}.resend`)
              }
              onPress={() => {
                setResentInPlace(undefined);
                onResend();
              }}
              off={cooldown > 0}
              testID={`${copy}.resendSoon`}
            />
            <Text size={tokens.typeSmall.size} style={styles.secondary}>
              {t(`${copy}.resendNote`)}
            </Text>
          </View>
        </>
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spaceXl },
  resend: { alignItems: 'flex-start', gap: tokens.spaceXs },
  secondary: { color: tokens.colorInkSecondary },
});
