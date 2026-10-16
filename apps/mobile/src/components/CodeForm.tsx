import { formatCountdown } from '@soirely/domain';
import { type ReactNode, type Ref, useRef } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { type CodeStatus, asksForCode } from '../kit/code.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { CodeField, Field } from './Field.tsx';
import { Notice } from './Notice.tsx';
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
  children,
}: {
  copy: 'verifyEmail' | 'verifyPhone';
  status: CodeStatus;
  cooldown: number;
  error: string | null;
  onTyped: (code: string) => void;
  onLeft: (code: string) => void;
  onVerify: (code: string) => void;
  onResend: () => void;
  inputRef?: Ref<TextInput> | undefined;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const typed = useRef('');
  const verifying = status.kind === 'verifying';

  return (
    <View style={styles.form}>
      {status.kind === 'expired' && (
        <Notice
          tone="attention"
          mark="!"
          title={t(`${copy}.expiredTitle`)}
          body={t(`${copy}.expiredBody`)}
        />
      )}

      {status.kind === 'exhausted' && (
        <Notice
          tone="attention"
          mark="!"
          title={t(`${copy}.exhaustedTitle`)}
          body={t(`${copy}.exhaustedBody`)}
        />
      )}

      {status.kind === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t(`${copy}.failedTitle`)}
          body={t(`${copy}.failedBody`)}
        />
      )}

      {!asksForCode(status) && (
        <PrimaryButton label={t(`${copy}.resend`)} onPress={onResend} testID={`${copy}.resend`} />
      )}

      {asksForCode(status) && (
        <>
          <Field label={t(`${copy}.codeLabel`)} error={error}>
            <CodeField
              ref={inputRef}
              wrong={error != null}
              editable={!verifying}
              returnKeyType="done"
              onChangeText={(text) => {
                typed.current = text;
                onTyped(text);
              }}
              onBlur={() => onLeft(typed.current)}
              onSubmitEditing={() => onVerify(typed.current)}
              accessibilityLabel={t(`${copy}.codeLabel`)}
              testID={`${copy}.code`}
            />
          </Field>

          <PrimaryButton
            label={verifying ? t(`${copy}.submitting`) : t(`${copy}.submit`)}
            onPress={() => onVerify(typed.current)}
            busy={verifying}
            testID={`${copy}.submit`}
          />

          <View style={styles.resend}>
            <SecondaryButton
              label={
                cooldown > 0
                  ? t(`${copy}.resendIn`, { time: formatCountdown(cooldown) })
                  : t(`${copy}.resend`)
              }
              onPress={onResend}
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
  resend: { gap: tokens.spaceXs },
  secondary: { color: tokens.colorInkSecondary },
});
