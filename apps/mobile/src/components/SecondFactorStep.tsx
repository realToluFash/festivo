import { type SecondFactor } from '@soirely/api-client';
import { cleanCode, formatTimeOfDay } from '@soirely/domain';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { currentLocale } from '../i18n/index.ts';
import { type CodeMode, codeRefusal, typedCodeProblem } from '../kit/twoFactor.ts';
import { tokens } from '../theme/tokens.ts';
import { AuthFrame, AuthHeading } from './AuthFrame.tsx';
import { Footnote, PrimaryButton, QuietButton } from './Buttons.tsx';
import { CodeField, Field, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';

type Status =
  | { kind: 'ready' }
  | { kind: 'checking' }
  | { kind: 'wrong'; message: string }
  | { kind: 'paused'; time: string; liftsAt: number }
  | { kind: 'failed' };

/** "Enter your code", for any step a second factor guards: a sign-in, or a password reset. */
export function SecondFactorStep({
  title,
  intro,
  recoveryIntro,
  submitLabel,
  pausedNote,
  onVerify,
  onExpired,
}: {
  title?: string;
  intro: string;
  recoveryIntro: string;
  submitLabel: string;
  pausedNote?: string;
  onVerify: (factor: SecondFactor) => Promise<void>;
  onExpired: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<CodeMode>('app');
  const [status, setStatus] = useState<Status>({ kind: 'ready' });
  const [blank, setBlank] = useState<string | null>(null);
  const typed = useRef('');
  const input = useRef<TextInput>(null);

  const checking = status.kind === 'checking';
  const liftsAt = status.kind === 'paused' ? status.liftsAt : null;
  const error = blank ?? (status.kind === 'wrong' ? status.message : null);

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = setTimeout(
      () => {
        input.current?.clear();
        typed.current = '';
        setStatus({ kind: 'ready' });
      },
      Math.max(0, liftsAt - Date.now()),
    );

    return () => clearTimeout(lift);
  }, [liftsAt]);

  function switchTo(next: CodeMode): void {
    setMode(next);
    typed.current = '';
    setBlank(null);
    if (status.kind === 'wrong') setStatus({ kind: 'ready' });
  }

  async function submit(): Promise<void> {
    if (checking || status.kind === 'paused') return;

    // Checked before sending, and a failed check costs no attempt.
    const problem = typedCodeProblem(mode, typed.current);
    setBlank(problem == null ? null : t(problem));
    if (problem != null) {
      input.current?.focus();
      return;
    }

    setStatus({ kind: 'checking' });

    try {
      await onVerify(
        mode === 'app'
          ? { code: cleanCode(typed.current) }
          : { recoveryCode: typed.current.trim() },
      );
      setStatus({ kind: 'ready' });
    } catch (error) {
      const refusal = codeRefusal(error, mode);

      if (refusal.kind === 'expired') {
        onExpired();
        return;
      }

      setStatus(
        refusal.kind === 'wrong'
          ? { kind: 'wrong', message: t(refusal.message) }
          : refusal.kind === 'paused'
            ? {
                kind: 'paused',
                time: formatTimeOfDay(refusal.liftsAt, currentLocale()),
                liftsAt: refusal.liftsAt.getTime(),
              }
            : { kind: 'failed' },
      );
    }
  }

  const label = mode === 'app' ? t('twoFactor.code') : t('twoFactor.recoveryCode');
  const sharedInput = {
    ref: input,
    wrong: error != null,
    editable: !checking,
    onChangeText: (text: string) => {
      typed.current = text;
      setBlank(null);
      if (status.kind === 'wrong') setStatus({ kind: 'ready' });
    },
    returnKeyType: 'go' as const,
    onSubmitEditing: () => void submit(),
    accessibilityLabel: label,
    testID: 'twoFactor.code',
  };

  return (
    <AuthFrame
      saying={
        <AuthHeading
          title={mode === 'app' ? (title ?? t('twoFactor.title')) : t('twoFactor.recoveryTitle')}
          intro={mode === 'app' ? intro : recoveryIntro}
        />
      }
    >
      <View style={styles.form}>
        <QuietButton
          label={t('twoFactor.back')}
          onPress={() => router.replace('/sign-in')}
          testID="twoFactor.back"
        />

        {status.kind === 'paused' && (
          <View style={styles.paused}>
            <Notice
              tone="attention"
              mark="!"
              title={t('twoFactor.pausedTitle')}
              body={
                pausedNote == null
                  ? t('twoFactor.pausedBody', { time: status.time })
                  : `${t('twoFactor.pausedBody', { time: status.time })} ${pausedNote}`
              }
            />
            <Footnote
              question={t('twoFactor.notYou')}
              action={t('twoFactor.resetPassword')}
              onPress={() => router.push('/forgot-password')}
              role="link"
              testID="twoFactor.reset"
            />
          </View>
        )}

        {status.kind === 'failed' && (
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            title={t('signIn.failedTitle')}
            body={t('signIn.failedBody')}
          />
        )}

        {/* Keyed by mode, so switching never carries a typed code into the other field. */}
        <Field key={mode} label={label} error={error}>
          {mode === 'app' ? (
            <CodeField {...sharedInput} />
          ) : (
            <TextField {...sharedInput} autoCapitalize="none" autoComplete="off" />
          )}
        </Field>

        <PrimaryButton
          label={
            status.kind === 'paused'
              ? t('twoFactor.tryAgainAt', { time: status.time })
              : mode === 'app'
                ? submitLabel
                : t('twoFactor.useThisCode')
          }
          onPress={() => void submit()}
          busy={checking}
          off={status.kind === 'paused'}
          testID="twoFactor.verify"
        />

        <QuietButton
          label={mode === 'app' ? t('twoFactor.useRecovery') : t('twoFactor.useApp')}
          onPress={() => switchTo(mode === 'app' ? 'recovery' : 'app')}
          testID="twoFactor.switch"
        />

        <Text size={tokens.typeSmall.size} style={styles.secondary}>
          {t('twoFactor.lostBoth')}
        </Text>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spaceXl },
  paused: { gap: tokens.spaceSm },
  secondary: { color: tokens.colorInkSecondary },
});
