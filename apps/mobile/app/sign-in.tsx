import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { Footnote, PrimaryButton, QuietButton } from '../src/components/Buttons.tsx';
import { Field, TextField } from '../src/components/Field.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { Text } from '../src/components/Text.tsx';
import { PasswordField } from '../src/components/PasswordField.tsx';
import { ProviderButtons, ProviderSignIn } from '../src/components/ProviderSignIn.tsx';
import { currentLocale, dateLocale } from '../src/i18n/index.ts';
import { emailMessage, useFormChecks } from '../src/kit/formChecks.ts';
import { tokens } from '../src/theme/tokens.ts';
import { nextAfterSignIn } from '../src/challenge.ts';
import {
  type RuleRefusal,
  providerNames,
  refusalFromParams,
  ruleRefusal,
} from '../src/kit/signInRules.ts';
import { useLayout } from '../src/layout/useLayout.ts';

type Status =
  | { kind: 'ready' }
  | { kind: 'signingIn' }
  | { kind: 'refused' }
  | { kind: 'rateLimited'; retryAt: string; liftsAt: number }
  | { kind: 'providerFailed'; provider: string }
  | { kind: 'failed' }
  | { kind: 'sessionEnded' }
  | { kind: 'ruled'; refusal: RuleRefusal };

export default function SignIn() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    signedOut?: string;
    providerFailed?: string;
    rule?: string;
    organisation?: string;
    days?: string;
    email?: string;
    providers?: string;
  }>();
  const [status, setStatus] = useState<Status>(() => {
    const refusal = refusalFromParams(params);

    if (params.providerFailed != null)
      return { kind: 'providerFailed', provider: params.providerFailed };
    if (refusal != null) return { kind: 'ruled', refusal };

    return params.signedOut == null ? { kind: 'ready' } : { kind: 'sessionEnded' };
  });

  async function signIn(email: string, password: string): Promise<void> {
    setStatus({ kind: 'signingIn' });

    try {
      router.replace(await nextAfterSignIn(await api.signIn(email, password)));
    } catch (error) {
      setStatus(refusalFrom(error));
    }
  }

  const liftLock = useCallback(() => setStatus({ kind: 'ready' }), []);

  return (
    <AuthFrame
      saying={
        <AuthHeading title={t('signIn.title')} intro={t('signIn.landscapeIntro')} introBeside />
      }
    >
      <Credentials
        status={status}
        onSubmit={signIn}
        onLockLifted={liftLock}
        onProviderFailed={(provider) => setStatus({ kind: 'providerFailed', provider })}
        onAnotherAccount={() => setStatus({ kind: 'ready' })}
      />
    </AuthFrame>
  );
}

function Credentials({
  status,
  onSubmit,
  onLockLifted,
  onProviderFailed,
  onAnotherAccount,
}: {
  status: Status;
  onSubmit: (email: string, password: string) => void;
  onLockLifted: () => void;
  onProviderFailed: (provider: string) => void;
  onAnotherAccount: () => void;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const email = useRef<TextInput>(null);
  const password = useRef<TextInput>(null);

  // Read once: the field is uncontrolled, and a later status must not clear what was typed.
  const [keptEmail] = useState(() =>
    status.kind === 'ruled' && status.refusal.kind === 'timedOut' ? status.refusal.email : '',
  );
  // Uncontrolled: a `value` prop re-renders between keystrokes and drops characters.
  const typed = useRef({ email: keptEmail, password: '' });
  const checks = useFormChecks(
    ['email', 'password'] as const,
    (field, value) =>
      field === 'email' ? emailMessage(value, t) : value === '' ? t('signIn.passwordBlank') : null,
    (field) => (field === 'email' ? email : password).current?.focus(),
  );

  const submit = (): void => {
    if (!checks.passes(typed.current)) return;

    onSubmit(typed.current.email.trim(), typed.current.password);
  };

  // What the screen opened with was not an answer to a tap, so it is not read out.
  const [opened] = useState(status);
  const answer = status === opened ? undefined : status;
  const busy = status.kind === 'signingIn';
  const refusal = status.kind === 'ruled' ? status.refusal : null;
  // A password cannot sign this account in, so the form gives way to the provider buttons.
  const providerOnly = refusal?.kind === 'providerOnly';
  const locked = status.kind === 'rateLimited';
  const liftsAt = status.kind === 'rateLimited' ? status.liftsAt : null;

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = setTimeout(
      () => {
        password.current?.clear();
        typed.current.password = '';
        onLockLifted();
      },
      Math.max(0, liftsAt - Date.now()),
    );

    return () => clearTimeout(lift);
  }, [liftsAt, onLockLifted]);

  return (
    <View style={styles.form}>
      {status.kind === 'sessionEnded' && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          title={t('signIn.endedTitle')}
          body={t('signIn.endedBody')}
        />
      )}

      {refusal?.kind === 'timedOut' && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          title={t('signIn.timedOutTitle', { organisation: refusal.organisation })}
          body={t('signIn.timedOutBody', {
            organisation: refusal.organisation,
            count: refusal.days,
          })}
        />
      )}

      {refusal?.kind === 'providerOnly' && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          title={t('signIn.providerOnlyTitle', { organisation: refusal.organisation })}
          body={t('signIn.providerOnlyBody', {
            organisation: refusal.organisation,
            providers: new Intl.ListFormat(currentLocale(), { type: 'disjunction' }).format(
              providerNames(refusal.providers),
            ),
          })}
          answers={answer}
        />
      )}

      {status.kind === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('signIn.failedTitle')}
          body={t('signIn.failedBody')}
          answers={answer}
        />
      )}

      {status.kind === 'rateLimited' && (
        <Notice
          tone="attention"
          mark="!"
          title={t('signIn.lockedTitle')}
          body={t('signIn.lockedBody', { time: status.retryAt })}
          action={{
            label: t('signIn.lockedReset'),
            onPress: () => router.push('/forgot-password'),
            testID: 'signIn.locked.reset',
          }}
          answers={answer}
        />
      )}

      {status.kind === 'providerFailed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('signIn.providerFailedTitle', { provider: status.provider })}
          body={t('signIn.providerFailedBody', { provider: status.provider })}
          answers={answer}
        />
      )}

      {!providerOnly && (
        <>
          <Field label={t('signIn.email')} error={checks.errors.email}>
            <TextField
              ref={email}
              wrong={checks.errors.email != null}
              editable={!busy}
              defaultValue={keptEmail}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              onChangeText={(text) => {
                typed.current.email = text;
                checks.edited('email', text);
              }}
              onBlur={() => checks.left('email', typed.current.email)}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => password.current?.focus()}
              accessibilityLabel={t('signIn.email')}
              testID="signIn.email"
            />
          </Field>

          <Field
            label={t('signIn.password')}
            labelAction={{
              label: kind === 'phone' ? t('recovery.forgotShort') : t('recovery.forgot'),
              onPress: () => router.push('/forgot-password'),
              testID: 'signIn.forgot',
            }}
            error={
              checks.errors.password ?? (status.kind === 'refused' ? t('signIn.refused') : null)
            }
            errorActions={
              checks.errors.password == null && status.kind === 'refused'
                ? [
                    {
                      label: t('signIn.lockedReset'),
                      onPress: () => router.push('/forgot-password'),
                      testID: 'signIn.refused.reset',
                    },
                  ]
                : undefined
            }
          >
            <PasswordField
              ref={password}
              wrong={status.kind === 'refused' || checks.errors.password != null}
              submitting={busy}
              editable={!busy}
              autoComplete="current-password"
              textContentType="password"
              onChangeText={(text) => {
                typed.current.password = text;
                checks.edited('password', text);
              }}
              onBlur={() => checks.left('password', typed.current.password)}
              returnKeyType="go"
              onSubmitEditing={submit}
              accessibilityLabel={t('signIn.password')}
              testID="signIn.password"
            />
          </Field>

          <PrimaryButton
            label={
              locked
                ? t('signIn.lockedUntil', { time: status.retryAt })
                : busy
                  ? t('signIn.submitting')
                  : t('signIn.submit')
            }
            onPress={submit}
            busy={busy}
            off={locked}
            testID="signIn.submit"
          />
        </>
      )}

      {refusal?.kind === 'providerOnly' ? (
        <>
          {refusal.email !== '' && (
            <Field label={t('signIn.email')}>
              <TextField
                editable={false}
                defaultValue={refusal.email}
                accessibilityLabel={t('signIn.email')}
                testID="signIn.email"
              />
            </Field>
          )}

          <ProviderButtons only={refusal.providers} onFailed={onProviderFailed} />

          <Text size={tokens.typeSmall.size} muted>
            {t('signIn.providerOnlyFootnote', { organisation: refusal.organisation })}
          </Text>

          <QuietButton
            label={t('signIn.anotherAccount')}
            onPress={onAnotherAccount}
            testID="signIn.anotherAccount"
          />
        </>
      ) : (
        <ProviderSignIn onFailed={onProviderFailed} />
      )}

      <Footnote
        question={t('signIn.newHere')}
        action={t('signIn.createAccount')}
        onPress={() => router.push('/register')}
        role="link"
        testID="signIn.register"
      />
    </View>
  );
}

function refusalFrom(error: unknown): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('invalid_credentials')) return { kind: 'refused' };

  const refusal = ruleRefusal(error.problem);
  if (refusal != null) return { kind: 'ruled', refusal };

  if (error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    if (liftsAt != null) {
      return {
        kind: 'rateLimited',
        retryAt: formatTimeOfDay(liftsAt, dateLocale()),
        liftsAt: liftsAt.getTime(),
      };
    }
  }

  return { kind: 'failed' };
}

const styles = StyleSheet.create({
  form: { gap: tokens.spaceXl },
});
