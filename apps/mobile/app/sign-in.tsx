import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { PrimaryButton, QuietButton } from '../src/components/Buttons.tsx';
import { AboveKeyboardView, AnswerInView } from '../src/components/Screen.tsx';
import { focusChecked, focusRefused, keysStayDown } from '../src/components/Field.tsx';
import { ProviderButtons } from '../src/components/ProviderSignIn.tsx';
import { Text } from '../src/components/Text.tsx';
import { tap } from '../src/steps/haptics.ts';
import { InsideField } from '../src/steps/InsideField.tsx';
import { Heading, Says } from '../src/steps/Lines.tsx';
import { useShake } from '../src/steps/shake.ts';
import { InSheet, NavBar, StepScreen, useStepsInSheet } from '../src/steps/StepScreen.tsx';
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

type Status =
  | { kind: 'ready' }
  | { kind: 'signingIn' }
  | { kind: 'refused' }
  | { kind: 'rateLimited'; retryAt: string; liftsAt: number }
  /** Tapped on the provider buttons a rule left, which give way to the form. */
  | { kind: 'providerFailed'; provider: string }
  | { kind: 'failed' }
  | { kind: 'ruled'; refusal: RuleRefusal };

/** Email sign-in, its own step after welcome: no logo, no Google or Apple, and no "or" (sc-29076). */
export default function SignIn() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [below] = useState(() => navigation.canGoBack());
  const sheet = useStepsInSheet() && below;
  const params = useLocalSearchParams<{
    rule?: string;
    organisation?: string;
    days?: string;
    email?: string;
    providers?: string;
  }>();
  const [status, setStatus] = useState<Status>(() => {
    const refusal = refusalFromParams(params);

    return refusal?.kind === 'providerOnly' ? { kind: 'ruled', refusal } : { kind: 'ready' };
  });
  const [carried] = useState(params.email ?? '');
  const typed = useRef({ email: carried, password: '' });
  const emailField = useRef<TextInputInstance>(null);
  const passwordField = useRef<TextInputInstance>(null);
  const { shaken, shake } = useShake();
  const checks = useFormChecks(
    ['email', 'password'] as const,
    (field, value) =>
      field === 'email' ? emailMessage(value, t) : value === '' ? t('signIn.passwordBlank') : null,
    (field) => focusChecked(field === 'email' ? emailField : passwordField),
  );

  const busy = status.kind === 'signingIn';
  const locked = status.kind === 'rateLimited';
  const refusal = status.kind === 'ruled' ? status.refusal : null;
  const liftsAt = locked ? status.liftsAt : null;
  const liftLock = useCallback(() => setStatus({ kind: 'ready' }), []);
  const [passwordsWiped, wipePassword] = useState(0);

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = setTimeout(
      () => {
        typed.current.password = '';
        wipePassword((wiped) => wiped + 1);
        liftLock();
      },
      Math.max(0, liftsAt - Date.now()),
    );

    return () => clearTimeout(lift);
  }, [liftsAt, liftLock]);

  function submit(): void {
    const { email, password } = typed.current;
    if (
      status.kind === 'signingIn' ||
      status.kind === 'rateLimited' ||
      !checks.passes({ email, password })
    )
      return;

    keysStayDown();
    onSubmit(email.trim(), password);
  }

  function onSubmit(address: string, typed: string): void {
    setStatus({ kind: 'signingIn' });

    void api
      .signIn(address, typed)
      .then(nextAfterSignIn)
      .then((next) => {
        tap.light();
        router.replace(next);
      })
      .catch((error: unknown) => {
        const refused = refusalFrom(error);
        setStatus(refused);
        if (refused.kind !== 'refused') return;

        // A wrong pair: both fields shake once, the password kept and selected to type again.
        tap.wrong();
        shake();
        focusRefused(passwordField);
        passwordField.current?.setSelection(0, typed.length);
      });
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));
  const forgot = () => {
    const email = typed.current.email.trim();
    router.push({ pathname: '/forgot-password', params: email === '' ? {} : { email } });
  };

  const forgotLink = (
    <View style={styles.forgot}>
      <QuietButton label={t('recovery.forgot')} onPress={forgot} testID="signIn.forgot" />
    </View>
  );

  return (
    <InSheet value={sheet}>
      <StepScreen
        nav={<NavBar left="back" onLeft={back} testID="signIn" />}
        foot={
          refusal?.kind === 'providerOnly' ? undefined : (
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
          )
        }
      >
        <Heading title={t('signIn.title')} />

        {locked && <Line words={t('signIn.lockedTitle')} />}
        {status.kind === 'failed' && (
          <Says words={`${t('signIn.failedTitle')}. ${t('signIn.failedBody')}`} />
        )}
        {status.kind === 'providerFailed' && (
          <Says
            words={`${t('signIn.providerFailedTitle', { provider: status.provider })}. ${t('signIn.providerFailedBody', { provider: status.provider })}`}
          />
        )}

        {refusal?.kind === 'providerOnly' ? (
          <View style={styles.providerOnly}>
            <Line
              words={`${t('signIn.providerOnlyTitle', { organisation: refusal.organisation })}. ${t(
                'signIn.providerOnlyBody',
                {
                  organisation: refusal.organisation,
                  providers: new Intl.ListFormat(currentLocale(), { type: 'disjunction' }).format(
                    providerNames(refusal.providers),
                  ),
                },
              )}`}
            />
            {refusal.email !== '' && (
              <InsideField
                label={t('signIn.email')}
                value={refusal.email}
                editable={false}
                testID="signIn.email"
              />
            )}
            <ProviderButtons
              only={refusal.providers}
              onFailed={(provider) => setStatus({ kind: 'providerFailed', provider })}
            />
            <Text size={tokens.typeSmall.size} muted>
              {t('signIn.providerOnlyFootnote', { organisation: refusal.organisation })}
            </Text>
            <QuietButton
              label={t('signIn.anotherAccount')}
              // The form comes back with its address field focused on arrival.
              onPress={() => {
                typed.current = { email: carried, password: '' };
                setStatus({ kind: 'ready' });
              }}
              testID="signIn.anotherAccount"
            />
          </View>
        ) : (
          <>
            <Animated.View style={[styles.first, shaken]}>
              <InsideField
                ref={emailField}
                label={t('signIn.email')}
                defaultValue={carried}
                onChangeText={(text) => {
                  typed.current.email = text;
                  checks.edited('email', text);
                }}
                onBlur={() => checks.left('email', typed.current.email)}
                state={checks.errors.email == null ? 'plain' : 'blank'}
                submitting={busy}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordField.current?.focus()}
                autoFocus={carried === ''}
                testID="signIn.email"
              />
              {checks.errors.email != null && <Says words={checks.errors.email} />}
            </Animated.View>
            {/* A refusal answered before the keys come up: once they do, the reset link lifts with the field above the docked foot. */}
            <AboveKeyboardView still={status.kind !== 'refused'}>
              <Animated.View style={[styles.next, shaken]}>
                <InsideField
                  key={passwordsWiped}
                  ref={passwordField}
                  label={t('signIn.password')}
                  onChangeText={(text) => {
                    typed.current.password = text;
                    checks.edited('password', text);
                    if (status.kind === 'refused') setStatus({ kind: 'ready' });
                  }}
                  onBlur={() => checks.left('password', typed.current.password)}
                  password
                  state={checks.errors.password == null ? 'plain' : 'blank'}
                  submitting={busy}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  submitBehavior="submit"
                  onSubmitEditing={submit}
                  autoFocus={carried !== ''}
                  testID="signIn.password"
                />
              </Animated.View>
              {checks.errors.password != null && <Says words={checks.errors.password} />}
              {status.kind === 'refused' ? (
                // The answer brings the reset link into sight too, above a foot docked on the keys.
                <AnswerInView>
                  <Says words={t('signIn.refused')} />
                  {forgotLink}
                </AnswerInView>
              ) : (
                forgotLink
              )}
            </AboveKeyboardView>
          </>
        )}
      </StepScreen>
    </InSheet>
  );
}

/** A notice as one plain line under the title: no box and no mark. */
function Line({ words }: { words: string }) {
  return <Says words={words} quiet />;
}

function refusalFrom(error: unknown): Status {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('invalid_credentials')) return { kind: 'refused' };

  const refusal = ruleRefusal(error.problem);
  if (refusal?.kind === 'providerOnly') return { kind: 'ruled', refusal };

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
  first: { marginTop: tokens.space3xl },
  next: { marginTop: tokens.spaceXl },
  forgot: { marginTop: tokens.spaceSm, alignItems: 'flex-start' },
  providerOnly: { marginTop: tokens.space3xl, gap: tokens.spaceXl },
});
