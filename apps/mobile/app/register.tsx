import {
  ACCOUNT_NAME_MAXIMUM,
  PASSWORD_MINIMUM_LENGTH,
  meetsPasswordLength,
} from '@soirely/domain';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import type { NativeStackNavigationProp } from 'expo-router/native-stack';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { PrimaryButton } from '../src/components/Buttons.tsx';
import { focusChecked, keysStayDown } from '../src/components/Field.tsx';
import { AboveKeyboardView } from '../src/components/Screen.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { dateLocale } from '../src/i18n/index.ts';
import { emailMessage } from '../src/kit/formChecks.ts';
import { useReadOut } from '../src/components/ReadOut.tsx';
import { holdRegistration } from '../src/pendingRegistration.ts';
import {
  type RegistrationFieldError,
  type RegistrationStatus,
  registrationRefusal,
} from '../src/registration.ts';
import { FieldLine, InsideField } from '../src/steps/InsideField.tsx';
import { Heading, Says } from '../src/steps/Lines.tsx';
import { NavBar, StepScreen } from '../src/steps/StepScreen.tsx';
import { tokens } from '../src/theme/tokens.ts';

type Which = 'name' | 'email' | 'password';

/** The first of four steps: name, email and password. Back from the email code returns here, the address kept to fix. */
export default function Register() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string; timedOut?: string }>();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const [status, setStatus] = useState<RegistrationStatus>({ kind: 'ready' });
  const [name, setName] = useState('');
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  // Said without moving focus from Password; it goes once Create account is pressed (sc-29923).
  const [line, setLine] = useState<string | null>(null);
  // Checked before sending; a refusal from the server shows the same way.
  const [checked, setChecked] = useState<Partial<Record<Which, string>>>({});
  const nameField = useRef<TextInputInstance>(null);
  const emailField = useRef<TextInputInstance>(null);
  const passwordField = useRef<TextInputInstance>(null);
  const long = meetsPasswordLength(password);
  const busy = status.kind === 'submitting';
  const locked = status.kind === 'rateLimited';
  const liftsAt = locked ? status.liftsAt : null;
  const refused = status.kind === 'refused' ? status.fields : {};

  useReadOut(line);

  // Back over the email code, this screen is still mounted with the password in it.
  const [timedOutAt, setTimedOutAt] = useState<string | undefined>(undefined);
  if (params.timedOut !== timedOutAt) {
    setTimedOutAt(params.timedOut);
    if (params.timedOut != null) {
      setPassword('');
      if (params.email != null) setEmail(params.email);
      setChecked({});
      setStatus({ kind: 'ready' });
      setLine(t('register.timedOut'));
    }
  }

  useEffect(() => {
    if (params.timedOut == null) return;

    focusChecked(passwordField);
    // Android ignores a focus on this screen while the email code is still sliding off it (sc-29923).
    const listeners = [
      navigation.addListener('transitionEnd', (event) => {
        if (event.data.closing) return;
        unlisten();
        focusChecked(passwordField);
      }),
      navigation.addListener('blur', () => unlisten()),
    ];
    const unlisten = () => listeners.forEach((remove) => remove());

    return unlisten;
  }, [navigation, params.timedOut]);

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = setTimeout(() => setStatus({ kind: 'ready' }), Math.max(0, liftsAt - Date.now()));

    return () => clearTimeout(lift);
  }, [liftsAt]);

  function words(which: Which): string | null {
    return checked[which] ?? refusalWords(refused[which], t);
  }

  async function submit(): Promise<void> {
    if (busy || locked) return;

    setLine(null);
    const found: Partial<Record<Which, string>> = {};
    if (name.trim() === '') found.name = t('register.nameBlank');
    const emailProblem = emailMessage(email, t);
    if (emailProblem != null) found.email = emailProblem;
    if (password === '') found.password = t('register.passwordBlank');
    // The rule is stated before submit, so a short password is never sent.
    else if (!long) found.password = '';
    setChecked(found);

    const first = (['name', 'email', 'password'] as const).find((which) => which in found);
    if (first != null) {
      focusChecked({ name: nameField, email: emailField, password: passwordField }[first]);
      return;
    }

    keysStayDown();
    setStatus({ kind: 'submitting' });

    try {
      // Every address gets this same answer, so where it goes next says nothing either.
      await holdRegistration(await api.register(email.trim(), name.trim(), password));
      setStatus({ kind: 'ready' });
      router.push('/verify-email');
    } catch (error) {
      setStatus(registrationRefusal(error, dateLocale()));
    }
  }

  function typed(which: Which, set: (text: string) => void) {
    return (text: string) => {
      set(text);
      setChecked((now) => ({ ...now, [which]: undefined }));
      if (status.kind === 'refused') setStatus({ kind: 'ready' });
    };
  }

  const said = { name: words('name'), email: words('email'), password: words('password') };

  return (
    <StepScreen
      nav={
        <NavBar
          onLeft={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
          step={[1, 4]}
          testID="register"
        />
      }
      foot={
        <PrimaryButton
          label={busy ? t('register.submitting') : t('register.submit')}
          onPress={() => void submit()}
          busy={busy}
          off={locked}
          testID="register.submit"
        />
      }
    >
      <Heading title={t('register.title')} {...(line != null && { intro: line })} />
      {status.kind === 'rateLimited' && (
        <View style={styles.notice}>
          <Notice
            tone="attention"
            mark="!"
            title={t('register.limitedTitle')}
            body={t('register.limitedBody', { time: status.retryAt })}
            answer={status}
          />
        </View>
      )}
      {status.kind === 'failed' && (
        <View style={styles.notice}>
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            title={t('register.failedTitle')}
            body={t('register.failedBody')}
            answer={status}
          />
        </View>
      )}
      <AboveKeyboardView style={styles.first}>
        <InsideField
          ref={nameField}
          label={t('register.name')}
          value={name}
          onChangeText={typed('name', setName)}
          state={said.name != null ? 'blank' : 'plain'}
          line={said.name}
          submitting={busy}
          maxLength={ACCOUNT_NAME_MAXIMUM}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailField.current?.focus()}
          autoFocus={params.email == null}
          testID="register.name"
        />
        {said.name != null && <Says words={said.name} />}
      </AboveKeyboardView>
      <AboveKeyboardView style={styles.next}>
        <InsideField
          ref={emailField}
          label={t('register.email')}
          value={email}
          onChangeText={typed('email', setEmail)}
          state={said.email != null ? 'blank' : 'plain'}
          line={said.email}
          submitting={busy}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordField.current?.focus()}
          autoFocus={params.email != null && params.timedOut == null}
          testID="register.email"
        />
        {said.email != null && <Says words={said.email} />}
      </AboveKeyboardView>
      <AboveKeyboardView style={styles.next}>
        <InsideField
          ref={passwordField}
          label={t('register.password')}
          value={password}
          onChangeText={typed('password', setPassword)}
          password
          state={said.password != null ? 'blank' : 'plain'}
          line={
            said.password === ''
              ? t('register.ruleLength', { count: PASSWORD_MINIMUM_LENGTH })
              : said.password
          }
          submitting={busy}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          submitBehavior="submit"
          onSubmitEditing={() => void submit()}
          autoFocus={params.timedOut != null}
          testID="register.password"
        />
        {said.password != null && said.password !== '' ? (
          <Says words={said.password} />
        ) : (
          <FieldLine
            words={t('register.ruleLength', { count: PASSWORD_MINIMUM_LENGTH })}
            tone={long ? 'met' : said.password != null ? 'wrong' : 'unmet'}
          />
        )}
      </AboveKeyboardView>
    </StepScreen>
  );
}

function refusalWords(
  error: RegistrationFieldError | undefined,
  t: (key: string) => string,
): string | null {
  if (error == null) return null;
  if (error === 'breached') return t('register.breached');

  return error.message;
}

const styles = StyleSheet.create({
  notice: { marginTop: tokens.spaceXl },
  first: { marginTop: tokens.spaceXl },
  next: { marginTop: tokens.spaceXl },
});
