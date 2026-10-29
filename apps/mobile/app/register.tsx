import { meetsPasswordLength } from '@soirely/domain';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { api } from '../src/api.ts';
import { holdRegistration } from '../src/pendingRegistration.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { Footnote, PrimaryButton } from '../src/components/Buttons.tsx';
import { Field, focusChecked, keysStayDown, TextField } from '../src/components/Field.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { PasswordField } from '../src/components/PasswordField.tsx';
import { PasswordRule } from '../src/components/PasswordRule.tsx';
import { OrRule, ProviderButtons } from '../src/components/ProviderSignIn.tsx';
import { Text } from '../src/components/Text.tsx';
import { dateLocale } from '../src/i18n/index.ts';
import { emailMessage, useFormChecks } from '../src/kit/formChecks.ts';
import { useLayout } from '../src/layout/useLayout.ts';
import {
  type RegistrationFieldError,
  type RegistrationStatus,
  registrationRefusal,
} from '../src/registration.ts';
import { tokens } from '../src/theme/tokens.ts';

export default function Register() {
  const { kind } = useLayout();
  const { t } = useTranslation();
  const [status, setStatus] = useState<RegistrationStatus>({ kind: 'ready' });

  const liftsAt = status.kind === 'rateLimited' ? status.liftsAt : null;

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = setTimeout(() => setStatus({ kind: 'ready' }), Math.max(0, liftsAt - Date.now()));

    return () => clearTimeout(lift);
  }, [liftsAt]);

  async function register(name: string, email: string, password: string): Promise<void> {
    setStatus({ kind: 'submitting' });

    try {
      // Every address gets this same answer, so where it goes next says nothing either.
      await holdRegistration(await api.register(email, name, password));

      router.push('/verify-email');
    } catch (error) {
      setStatus(registrationRefusal(error, dateLocale()));
    }
  }

  const heading = <AuthHeading title={t('register.title')} intro={t('register.intro')} />;
  // Keyed, so the form keeps what was typed when a rotation moves it among the other pieces.
  const form = <Form key="form" status={status} onSubmit={register} />;
  const haveAccount = (
    <Footnote
      key="have-account"
      question={t('register.haveAccount')}
      action={t('register.signIn')}
      onPress={() => router.replace('/sign-in')}
      role="link"
      testID="register.signIn"
    />
  );

  // Where Google sits differs by size: beside the form on landscape, under it on portrait, above it on a phone.
  if (kind === 'tabletLandscape') {
    return (
      <AuthFrame
        saying={
          <>
            {heading}
            <View style={styles.providers}>
              <ProviderButtons />
              <Text size={tokens.typeBody.size} style={styles.secondary}>
                {t('register.landscapeNote')}
              </Text>
            </View>
          </>
        }
      >
        {form}
        {haveAccount}
      </AuthFrame>
    );
  }

  if (kind === 'tabletPortrait') {
    return (
      <AuthFrame saying={heading}>
        {form}
        <OrRule key="or" label={t('signIn.or')} />
        <ProviderButtons key="providers" />
        {haveAccount}
      </AuthFrame>
    );
  }

  return (
    <AuthFrame saying={heading} phoneTop={<BackRow />}>
      <ProviderButtons key="providers" />
      <OrRule key="or" label={t('register.orWithEmail')} />
      {form}
      {haveAccount}
    </AuthFrame>
  );
}

function BackRow() {
  const { t } = useTranslation();

  return (
    <View style={styles.backRow}>
      <Pressable
        style={styles.back}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
        accessibilityRole="button"
        accessibilityLabel={t('register.back')}
        testID="register.back"
      >
        <BackChevron />
      </Pressable>
      <Text size={tokens.typeTitleDialog.size} weight="bold">
        {t('app.name')}
      </Text>
    </View>
  );
}

function Form({
  status,
  onSubmit,
}: {
  status: RegistrationStatus;
  onSubmit: (name: string, email: string, password: string) => void;
}) {
  const { t } = useTranslation();
  const [lengthMet, setLengthMet] = useState(false);
  const name = useRef<TextInputInstance>(null);
  const email = useRef<TextInputInstance>(null);
  const password = useRef<TextInputInstance>(null);

  // Uncontrolled: a `value` prop re-renders between keystrokes and drops characters.
  const typed = useRef({ name: '', email: '', password: '' });

  const busy = status.kind === 'submitting';
  const locked = status.kind === 'rateLimited';
  const fields = status.kind === 'refused' ? status.fields : {};
  const checks = useFormChecks(
    ['name', 'email', 'password'] as const,
    (field, value) => {
      if (field === 'email') return emailMessage(value, t);
      if (value.trim() !== '') return null;

      return field === 'name' ? t('register.nameBlank') : t('register.passwordBlank');
    },
    (field) => focusChecked({ name, email, password }[field]),
  );

  const submit = (): void => {
    if (busy || locked) return;
    if (!checks.passes(typed.current)) return;

    // The rule is stated before submit, so a short password is never sent.
    if (!meetsPasswordLength(typed.current.password)) {
      focusChecked(password);
      return;
    }

    keysStayDown();
    onSubmit(typed.current.name.trim(), typed.current.email.trim(), typed.current.password);
  };

  return (
    <View style={styles.form}>
      {status.kind === 'rateLimited' && (
        <Notice
          tone="attention"
          mark="!"
          title={t('register.limitedTitle')}
          body={t('register.limitedBody', { time: status.retryAt })}
          answer={status}
        />
      )}

      {status.kind === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('register.failedTitle')}
          body={t('register.failedBody')}
          answer={status}
        />
      )}

      <Field label={t('register.name')} error={checks.errors.name ?? refusalWords(fields.name, t)}>
        <TextField
          ref={name}
          wrong={checks.errors.name != null || fields.name != null}
          submitting={busy}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          onChangeText={(text) => {
            typed.current.name = text;
            checks.edited('name', text);
          }}
          onBlur={() => checks.left('name', typed.current.name)}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => email.current?.focus()}
          accessibilityLabel={t('register.name')}
          testID="register.name"
        />
      </Field>

      <Field
        label={t('register.email')}
        error={checks.errors.email ?? refusalWords(fields.email, t)}
      >
        <TextField
          ref={email}
          wrong={checks.errors.email != null || fields.email != null}
          submitting={busy}
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
          accessibilityLabel={t('register.email')}
          testID="register.email"
        />
      </Field>

      <Field
        label={t('register.password')}
        error={checks.errors.password ?? refusalWords(fields.password, t)}
      >
        <PasswordField
          ref={password}
          wrong={checks.errors.password != null || fields.password != null}
          submitting={busy}
          autoComplete="new-password"
          textContentType="newPassword"
          onChangeText={(text) => {
            typed.current.password = text;
            setLengthMet(meetsPasswordLength(text));
            checks.edited('password', text);
          }}
          onBlur={() => checks.left('password', typed.current.password)}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={submit}
          accessibilityLabel={t('register.password')}
          testID="register.password"
        />
      </Field>

      <PasswordRule met={lengthMet} testID="register" />

      <PrimaryButton
        label={busy ? t('register.submitting') : t('register.submit')}
        onPress={submit}
        busy={busy}
        off={locked}
        testID="register.submit"
      />
    </View>
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

function BackChevron(): ReactNode {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="m15 18-6-6 6-6"
        stroke={tokens.colorInk}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  back: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    marginLeft: -tokens.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeHit / 2,
  },
  secondary: { color: tokens.colorInkSecondary },
  accentText: { color: tokens.colorAccentText },
  onAccent: { color: tokens.colorInkOnDark },
  providers: { gap: tokens.spaceMd, paddingTop: tokens.spaceSm },
  form: { gap: tokens.spaceXl },
});
