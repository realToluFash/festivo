import { awaiting } from '@soirely/api-client';
import { meetsPasswordLength, PASSWORD_MINIMUM_LENGTH } from '@soirely/domain';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { Footnote, PrimaryButton } from '../src/components/Buttons.tsx';
import { Field, TextField } from '../src/components/Field.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { PasswordField } from '../src/components/PasswordField.tsx';
import { OrRule, ProviderButtons } from '../src/components/ProviderSignIn.tsx';
import { Text } from '../src/components/Text.tsx';
import { currentLocale } from '../src/i18n/index.ts';
import { useLayout } from '../src/layout/useLayout.ts';
import {
  type RegistrationFieldError,
  type RegistrationStatus,
  registrationRefusal,
} from '../src/registration.ts';
import { tokens } from '../src/theme/tokens.ts';
import { landingFor } from '../src/landing.ts';

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
      const { account } = await api.register(email, name, password);

      router.replace(landingFor(awaiting(account)));
    } catch (error) {
      setStatus(registrationRefusal(error, currentLocale()));
    }
  }

  const heading = <AuthHeading title={t('register.title')} intro={t('register.intro')} />;
  const form = <Form status={status} onSubmit={register} />;
  const haveAccount = (
    <Footnote
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
        <OrRule label={t('signIn.or')} />
        <ProviderButtons />
        {haveAccount}
      </AuthFrame>
    );
  }

  return (
    <AuthFrame saying={heading} phoneTop={<BackRow />}>
      <ProviderButtons />
      <OrRule label={t('register.orWithEmail')} />
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
  const email = useRef<TextInput>(null);
  const password = useRef<TextInput>(null);

  // Uncontrolled: a `value` prop re-renders between keystrokes and drops characters.
  const typed = useRef({ name: '', email: '', password: '' });

  const busy = status.kind === 'submitting';
  const locked = status.kind === 'rateLimited';
  const fields = status.kind === 'refused' ? status.fields : {};

  const submit = (): void => {
    if (busy || locked) return;

    // The rule is stated before submit, so a short password is never sent.
    if (!meetsPasswordLength(typed.current.password)) {
      password.current?.focus();
      return;
    }

    onSubmit(typed.current.name.trim(), typed.current.email.trim(), typed.current.password);
  };

  const toSignIn = () => router.replace('/sign-in');

  return (
    <View style={styles.form}>
      {status.kind === 'rateLimited' && (
        <Notice
          tone="attention"
          mark="!"
          title={t('register.limitedTitle')}
          body={t('register.limitedBody', { time: status.retryAt })}
        />
      )}

      {status.kind === 'failed' && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('register.failedTitle')}
          body={t('register.failedBody')}
        />
      )}

      <Field label={t('register.name')} error={refusalWords(fields.name, t)}>
        <TextField
          wrong={fields.name != null}
          editable={!busy}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          onChangeText={(text) => {
            typed.current.name = text;
          }}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => email.current?.focus()}
          accessibilityLabel={t('register.name')}
          testID="register.name"
        />
      </Field>

      <Field
        label={t('register.email')}
        error={refusalWords(fields.email, t)}
        errorActions={
          fields.email === 'taken'
            ? [
                { label: t('register.signIn'), onPress: toSignIn, testID: 'register.taken.signIn' },
                // Recovery is sc-61; until it exists, both ways out start at sign-in.
                {
                  label: t('register.resetPassword'),
                  onPress: toSignIn,
                  testID: 'register.taken.reset',
                },
              ]
            : undefined
        }
      >
        <TextField
          ref={email}
          wrong={fields.email != null}
          editable={!busy}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          onChangeText={(text) => {
            typed.current.email = text;
          }}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => password.current?.focus()}
          accessibilityLabel={t('register.email')}
          testID="register.email"
        />
      </Field>

      <Field label={t('register.password')} error={refusalWords(fields.password, t)}>
        <PasswordField
          ref={password}
          wrong={fields.password != null}
          submitting={busy}
          editable={!busy}
          autoComplete="new-password"
          textContentType="newPassword"
          onChangeText={(text) => {
            typed.current.password = text;
            setLengthMet(meetsPasswordLength(text));
          }}
          returnKeyType="done"
          onSubmitEditing={submit}
          accessibilityLabel={t('register.password')}
          testID="register.password"
        />
      </Field>

      <View style={styles.ruleInset}>
        <Text size={tokens.typeLabel.size} weight="semibold" style={styles.ruleHeading}>
          {t('register.ruleHeading')}
        </Text>
        <View style={styles.rule} testID={lengthMet ? 'register.ruleMet' : 'register.ruleNotYet'}>
          <View style={[styles.ruleMark, lengthMet && styles.ruleMarkMet]}>
            {lengthMet && (
              <Text size={tokens.typeMeta.size} weight="bold" style={styles.onAccent}>
                ✓
              </Text>
            )}
          </View>
          <Text size={tokens.typeBodyPhone.size} style={styles.ruleText}>
            {t('register.ruleLength', { count: PASSWORD_MINIMUM_LENGTH })}
          </Text>
          <Text
            size={tokens.typeSmall.size}
            weight="semibold"
            style={lengthMet ? styles.accentText : styles.secondary}
          >
            {lengthMet ? t('register.ruleMet') : t('register.ruleNotYet')}
          </Text>
        </View>
        <Text size={tokens.typeSmall.size} style={styles.secondary}>
          {t('register.ruleNote')}
        </Text>
      </View>

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
  if (error === 'taken') return t('register.taken');
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
  ruleInset: {
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  ruleHeading: {
    color: tokens.colorInkSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: tokens.space3xl,
  },
  ruleMark: {
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeMark / 2,
    borderWidth: 1.5,
    borderColor: tokens.colorMarkEmpty,
    backgroundColor: tokens.colorCard,
  },
  ruleMarkMet: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccent },
  ruleText: { flex: 1 },
});
