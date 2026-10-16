import { awaiting } from '@soirely/api-client';
import { meetsPasswordLength, PASSWORD_MINIMUM_LENGTH } from '@soirely/domain';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { api } from '../src/api.ts';
import { LanguageChoice } from '../src/components/LanguageChoice.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { OrRule, ProviderButtons } from '../src/components/ProviderSignIn.tsx';
import { Screen } from '../src/components/Screen.tsx';
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

const CARD_WIDTH = 520;
const FORM_COLUMN_WIDTH = 600;
/** 16 is the smallest size iOS Safari will not zoom into on focus. */
const CONTROL_TEXT_SIZE = 16;

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

  const form = <Form status={status} onSubmit={register} />;

  if (kind === 'tabletLandscape') {
    return (
      <Screen style={styles.page} contentStyle={styles.landscapeContent}>
        <View style={styles.landscapeLeft}>
          <Brand />
          <View style={styles.landscapeSaying}>
            <Heading size={tokens.typeTitlePage.size} />
            <View style={styles.providers}>
              <ProviderButtons />
              <Text size={tokens.typeBody.size} style={styles.secondary}>
                {t('register.landscapeNote')}
              </Text>
            </View>
          </View>
          <LanguageChoice />
        </View>
        <View style={styles.landscapeRight}>
          <View style={[styles.card, styles.cardFill]}>
            {form}
            <HaveAccount />
          </View>
        </View>
      </Screen>
    );
  }

  if (kind === 'tabletPortrait') {
    return (
      <Screen style={styles.page} contentStyle={styles.portraitContent}>
        <Brand />
        <View style={styles.centred}>
          <View style={styles.card}>
            <Heading size={tokens.typeTitlePage.size} />
            {form}
            <OrRule label={t('signIn.or')} />
            <ProviderButtons />
            <HaveAccount />
          </View>
          <View style={styles.tabletLanguage}>
            <LanguageChoice />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.page} contentStyle={styles.phoneContent}>
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
        <Text size={tokens.typeTitleDialog.size} weight="bold" style={styles.brand}>
          {t('app.name')}
        </Text>
      </View>
      <Heading size={tokens.typeTitlePhone.size} />
      <ProviderButtons />
      <OrRule label={t('register.orWithEmail')} />
      {form}
      <HaveAccount />
      <LanguageChoice />
    </Screen>
  );
}

function Brand() {
  const { t } = useTranslation();

  return (
    <View style={styles.brandRow}>
      <Text size={tokens.typeTitleDialog.size} weight="bold" style={styles.brand}>
        {t('app.name')}
      </Text>
    </View>
  );
}

function Heading({ size }: { size: number }) {
  const { t } = useTranslation();

  return (
    <View style={styles.heading}>
      <Text size={size} weight="bold" style={styles.title} accessibilityRole="header">
        {t('register.title')}
      </Text>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('register.intro')}
      </Text>
    </View>
  );
}

function HaveAccount() {
  const { t } = useTranslation();

  return (
    <View style={styles.footnote}>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('register.haveAccount')}
      </Text>
      <Pressable
        style={styles.footnoteAction}
        onPress={() => router.replace('/sign-in')}
        accessibilityRole="link"
        testID="register.signIn"
      >
        <Text size={tokens.typeBodyPhone.size} weight="semibold" style={styles.accentText}>
          {t('register.signIn')}
        </Text>
      </Pressable>
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
  const [revealed, setRevealed] = useState(false);
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

  const input = {
    editable: !busy,
    autoCorrect: false,
    spellCheck: false,
    placeholderTextColor: tokens.colorInkTertiary,
    cursorColor: tokens.colorInk,
    selectionColor: tokens.colorInk,
  };

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

      <View style={styles.field}>
        <Text size={tokens.typeButton.size} weight="semibold">
          {t('register.name')}
        </Text>
        <TextInput
          {...input}
          style={[styles.input, fields.name != null && styles.inputWrong]}
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
        {fields.name != null && <FieldRefusal error={fields.name} />}
      </View>

      <View style={styles.field}>
        <Text size={tokens.typeButton.size} weight="semibold">
          {t('register.email')}
        </Text>
        <TextInput
          {...input}
          ref={email}
          style={[styles.input, fields.email != null && styles.inputWrong]}
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
        {fields.email != null && <FieldRefusal error={fields.email} />}
      </View>

      <View style={styles.field}>
        <Text size={tokens.typeButton.size} weight="semibold">
          {t('register.password')}
        </Text>
        <View style={styles.revealWrap}>
          <TextInput
            {...input}
            ref={password}
            style={[
              styles.input,
              styles.inputWithReveal,
              fields.password != null && styles.inputWrong,
            ]}
            secureTextEntry={!revealed}
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            onChangeText={(text) => {
              typed.current.password = text;
              setLengthMet(meetsPasswordLength(text));
            }}
            returnKeyType="done"
            onSubmitEditing={submit}
            accessibilityLabel={t('register.password')}
            testID="register.password"
          />
          <Pressable
            style={styles.reveal}
            onPress={() => setRevealed((shown) => !shown)}
            accessibilityRole="button"
            accessibilityState={{ selected: revealed }}
            testID="register.reveal"
          >
            <Text size={tokens.typeButton.size} weight="semibold" style={styles.accentText}>
              {revealed ? t('signIn.conceal') : t('signIn.reveal')}
            </Text>
          </Pressable>
        </View>
        {fields.password != null && <FieldRefusal error={fields.password} />}
      </View>

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

      <Pressable
        style={[styles.cta, busy && styles.ctaBusy, locked && styles.ctaOff]}
        onPress={submit}
        disabled={busy || locked}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || locked, busy }}
        testID="register.submit"
      >
        <Text
          size={CONTROL_TEXT_SIZE}
          weight="semibold"
          style={locked ? styles.secondary : styles.onAccent}
        >
          {busy ? t('register.submitting') : t('register.submit')}
        </Text>
      </Pressable>
    </View>
  );
}

function FieldRefusal({ error }: { error: RegistrationFieldError }) {
  const { t } = useTranslation();

  return (
    <View style={styles.fieldError}>
      <View style={styles.mark}>
        <Text size={tokens.typePill.size} weight="bold" style={styles.brokenText}>
          {tokens.marks.broken.glyph}
        </Text>
      </View>
      <View style={styles.fieldErrorBody}>
        <Text size={tokens.typeBodyPhone.size} style={styles.brokenText}>
          {error === 'taken'
            ? t('register.taken')
            : error === 'breached'
              ? t('register.breached')
              : error.message}
        </Text>
        {error === 'taken' && (
          <View style={styles.fieldErrorActions}>
            <TakenAction label={t('register.signIn')} testID="register.taken.signIn" />
            <TakenAction label={t('register.resetPassword')} testID="register.taken.reset" />
          </View>
        )}
      </View>
    </View>
  );
}

/** Recovery is sc-61; until it exists, both ways out start at sign-in. */
function TakenAction({ label, testID }: { label: string; testID: string }) {
  return (
    <Pressable
      style={styles.footnoteAction}
      onPress={() => router.replace('/sign-in')}
      accessibilityRole="link"
      testID={testID}
    >
      <Text size={tokens.typeBodyPhone.size} weight="semibold" style={styles.accentText}>
        {label}
      </Text>
    </Pressable>
  );
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
  page: { backgroundColor: tokens.colorPage },

  phoneContent: {
    flexGrow: 1,
    gap: tokens.spaceXl,
    paddingTop: tokens.spaceSm,
    paddingHorizontal: tokens.space3xl,
    paddingBottom: tokens.space5xl,
  },
  portraitContent: { flexGrow: 1, gap: tokens.space3xl, padding: tokens.space6xl },
  landscapeContent: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: tokens.space5xl,
    padding: tokens.space6xl,
  },

  brandRow: { height: tokens.sizeHit, justifyContent: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  back: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    marginLeft: -tokens.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeHit / 2,
  },
  brand: { letterSpacing: -0.4 },
  heading: { gap: tokens.spaceXs },
  title: { letterSpacing: -0.5 },
  secondary: { color: tokens.colorInkSecondary },
  accentText: { color: tokens.colorAccentText },
  brokenText: { color: tokens.colorBrokenText },
  onAccent: { color: tokens.colorInkOnDark },

  centred: { alignItems: 'center', gap: tokens.space3xl },
  tabletLanguage: { width: CARD_WIDTH, maxWidth: '100%' },
  landscapeLeft: { flex: 1, gap: tokens.space3xl },
  landscapeSaying: { flex: 1, justifyContent: 'center', gap: tokens.spaceXl, maxWidth: 460 },
  landscapeRight: { width: FORM_COLUMN_WIDTH, maxWidth: '50%' },
  providers: { gap: tokens.spaceMd, paddingTop: tokens.spaceSm },

  card: {
    width: CARD_WIDTH,
    maxWidth: '100%',
    gap: tokens.spaceXl,
    padding: tokens.space4xl,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusCardPhone,
  },
  cardFill: { width: '100%' },

  form: { gap: tokens.spaceXl },
  field: { gap: tokens.spaceXs },

  input: {
    height: tokens.sizeHitPhonePrimary,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
    color: tokens.colorInk,
    fontSize: CONTROL_TEXT_SIZE,
  },
  inputWithReveal: { paddingRight: 72 },
  inputWrong: { borderColor: tokens.colorBroken },
  revealWrap: { position: 'relative' },
  reveal: {
    position: 'absolute',
    top: 0,
    right: tokens.spaceHair,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
  },

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

  cta: {
    height: tokens.sizeHitPhonePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    backgroundColor: tokens.colorAccent,
  },
  ctaBusy: { backgroundColor: tokens.colorAccentHover },
  ctaOff: { backgroundColor: tokens.colorBorder },

  mark: {
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeMark / 2,
    borderWidth: 1.5,
    borderColor: tokens.marks.broken.ring,
    backgroundColor: tokens.marks.broken.fill,
  },
  fieldError: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  fieldErrorBody: { flex: 1, gap: tokens.spaceHair },
  fieldErrorActions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceXl },

  footnote: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceXs,
    paddingTop: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  footnoteAction: { minHeight: tokens.sizeHit, justifyContent: 'center' },
});
