import { ApiError, type Account, awaiting } from '@soirely/api-client';
import { deviceCountry, phoneLengthProblem } from '@soirely/domain';
import { getCalendars, getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { CountryPicker } from '../src/components/CountryPicker.tsx';
import { LanguageChoice } from '../src/components/LanguageChoice.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { OnboardingSteps } from '../src/components/OnboardingSteps.tsx';
import { Screen } from '../src/components/Screen.tsx';
import { Text } from '../src/components/Text.tsx';
import { landingFor } from '../src/landing.ts';
import { useLayout } from '../src/layout/useLayout.ts';
import { phoneProblemMessage } from '../src/phoneProblem.ts';
import { tokens } from '../src/theme/tokens.ts';

const CARD_WIDTH = 520;
const FORM_COLUMN_WIDTH = 600;
/** 16 is the smallest size iOS Safari will not zoom into on focus. */
const CONTROL_TEXT_SIZE = 16;
/** The API's OrganisationRules::NAME_MAXIMUM. */
const ORGANISATION_NAME_MAXIMUM = 100;

type Errors = Partial<
  Record<
    'name' | 'organisationName' | 'countryCode' | 'timezone' | 'phoneCountryCode' | 'phoneNumber',
    string | undefined
  >
>;

/** The second gate. Opens when the API says `profile_incomplete`, or after verifying. */
export default function CompleteProfile() {
  const { kind } = useLayout();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    let live = true;

    api
      .me()
      .then((signedIn) => {
        if (!live) return;

        const landing = landingFor(awaiting(signedIn));
        if (landing !== '/complete-profile') router.replace(landing);
        else setAccount(signedIn);
      })
      .catch(() => {
        if (live) router.replace('/');
      });

    return () => {
      live = false;
    };
  }, []);

  if (account == null) return <Screen style={styles.page}>{null}</Screen>;

  const form = <Details account={account} />;

  if (kind === 'tabletLandscape') {
    return (
      <Screen style={styles.page} contentStyle={styles.landscapeContent}>
        <View style={styles.landscapeLeft}>
          <Brand />
          <View style={styles.landscapeSaying}>
            <OnboardingSteps at="details" />
            <Heading size={tokens.typeTitlePage.size} />
          </View>
          <LanguageChoice />
        </View>
        <View style={styles.landscapeRight}>
          <View style={[styles.card, styles.cardFill]}>
            {form}
            <SignedInAs email={primary(account)} />
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
            <OnboardingSteps at="details" />
            <Heading size={tokens.typeTitlePage.size} />
            {form}
            <SignedInAs email={primary(account)} />
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
      <Brand />
      <OnboardingSteps at="details" />
      <Heading size={tokens.typeTitlePhone.size} />
      {form}
      <SignedInAs email={primary(account)} />
      <LanguageChoice />
    </Screen>
  );
}

function Details({ account }: { account: Account }) {
  const { t } = useTranslation();
  const [name, setName] = useState(account.name);
  const [organisationName, setOrganisationName] = useState('');
  const [countryCode, setCountryCode] = useState(
    () => deviceCountry(getLocales().map((locale) => locale.languageTag)) ?? 'NG',
  );
  const [phoneCountryCode, setPhoneCountryCode] = useState(countryCode);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const nameInput = useRef<TextInput>(null);
  const organisationInput = useRef<TextInput>(null);
  const phoneInput = useRef<TextInput>(null);

  const asksForOrganisation = account.needsOrganisation;

  async function save(): Promise<void> {
    if (saving) return;

    // Checked before sending, every field at once, and the first that needs attention is focused.
    const checked: Errors = {};
    if (name.trim() === '') checked.name = t('completeProfile.nameBlank');
    if (asksForOrganisation && organisationName.trim() === '') {
      checked.organisationName = t('completeProfile.organisationBlank');
    }
    // Optional: an empty field is no phone, so only a typed number is checked.
    if (phoneNumber.trim() !== '') {
      const problem = phoneProblemMessage(
        phoneLengthProblem(phoneNumber, phoneCountryCode),
        phoneCountryCode,
        t,
      );
      if (problem != null) checked.phoneNumber = problem;
    }

    if (Object.keys(checked).length > 0) {
      setErrors(checked);
      const first =
        checked.name != null
          ? nameInput
          : checked.organisationName != null
            ? organisationInput
            : phoneInput;
      first.current?.focus();
      return;
    }

    setSaving(true);
    setFailed(false);

    try {
      const saved = await api.completeProfile({
        name: name.trim(),
        ...(asksForOrganisation
          ? {
              organisationName: organisationName.trim(),
              countryCode,
              timezone: getCalendars()[0]?.timeZone ?? 'UTC',
            }
          : {}),
        phoneCountryCode,
        phoneNumber: phoneNumber.trim(),
      });

      router.replace(landingFor(awaiting(saved.account)));
    } catch (error) {
      setSaving(false);

      if (error instanceof ApiError && error.is('validation_failed')) {
        setErrors(error.fieldErrors() as Errors);
        return;
      }

      if (error instanceof ApiError && error.is('phone_taken')) {
        setErrors({ phoneNumber: t('verifyPhone.taken') });
        return;
      }

      setFailed(true);
    }
  }

  const input = {
    editable: !saving,
    autoCorrect: false,
    spellCheck: false,
    placeholderTextColor: tokens.colorInkTertiary,
    cursorColor: tokens.colorInk,
    selectionColor: tokens.colorInk,
  };

  return (
    <View style={styles.form}>
      {failed && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('completeProfile.failedTitle')}
          body={t('completeProfile.failedBody')}
        />
      )}

      <Field label={t('completeProfile.name')} error={errors.name}>
        <TextInput
          {...input}
          ref={nameInput}
          style={[styles.input, errors.name != null && styles.inputWrong]}
          value={name}
          onChangeText={(text) => {
            setName(text);
            setErrors((previous) => ({ ...previous, name: undefined }));
          }}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() =>
            (asksForOrganisation ? organisationInput : phoneInput).current?.focus()
          }
          accessibilityLabel={t('completeProfile.name')}
          testID="completeProfile.name"
        />
      </Field>

      {asksForOrganisation && (
        <>
          <Field
            label={t('completeProfile.organisation')}
            error={errors.organisationName}
            help={t('completeProfile.organisationHelp')}
          >
            <TextInput
              {...input}
              ref={organisationInput}
              style={[styles.input, errors.organisationName != null && styles.inputWrong]}
              value={organisationName}
              maxLength={ORGANISATION_NAME_MAXIMUM}
              onChangeText={(text) => {
                setOrganisationName(text);
                setErrors((previous) => ({ ...previous, organisationName: undefined }));
              }}
              autoComplete="organization"
              textContentType="organizationName"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => phoneInput.current?.focus()}
              accessibilityLabel={t('completeProfile.organisation')}
              testID="completeProfile.organisation"
            />
          </Field>

          <Field label={t('completeProfile.country')} error={errors.countryCode ?? errors.timezone}>
            <CountryPicker
              label={t('completeProfile.country')}
              value={countryCode}
              onChange={setCountryCode}
              disabled={saving}
              testID="completeProfile.country"
            />
          </Field>
        </>
      )}

      <Field
        label={t('verifyPhone.numberLabel')}
        pill={t('completeProfile.optional')}
        error={errors.phoneNumber ?? errors.phoneCountryCode}
        help={t('completeProfile.mobileHelp')}
      >
        <View style={styles.phoneEntry}>
          <View style={styles.phoneCountry}>
            <CountryPicker
              label={t('verifyPhone.countryLabel')}
              value={phoneCountryCode}
              onChange={(code) => {
                setPhoneCountryCode(code);
                setErrors((previous) => ({
                  ...previous,
                  phoneCountryCode: undefined,
                  phoneNumber: undefined,
                }));
              }}
              disabled={saving}
              withCallingCode
              testID="completeProfile.phoneCountry"
            />
          </View>
          <TextInput
            {...input}
            ref={phoneInput}
            style={[
              styles.input,
              styles.phoneNumber,
              errors.phoneNumber != null && styles.inputWrong,
            ]}
            value={phoneNumber}
            onChangeText={(text) => {
              setPhoneNumber(text);
              setErrors((previous) => ({ ...previous, phoneNumber: undefined }));
            }}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="done"
            onSubmitEditing={() => void save()}
            accessibilityLabel={t('verifyPhone.numberLabel')}
            testID="completeProfile.phoneNumber"
          />
        </View>
      </Field>

      <Pressable
        style={[styles.cta, saving && styles.ctaBusy]}
        onPress={() => void save()}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ busy: saving }}
        testID="completeProfile.save"
      >
        <Text size={CONTROL_TEXT_SIZE} weight="semibold" style={styles.onAccent}>
          {saving ? t('completeProfile.saving') : t('completeProfile.save')}
        </Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  pill,
  error,
  help,
  children,
}: {
  label: string;
  pill?: string;
  error: string | undefined;
  help?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text size={tokens.typeButton.size} weight="semibold">
          {label}
        </Text>
        {pill != null && (
          <View style={styles.pill}>
            <Text size={tokens.typePill.size} weight="semibold" style={styles.secondary}>
              {pill}
            </Text>
          </View>
        )}
      </View>
      {children}
      {error != null && (
        <View style={styles.fieldError}>
          <View style={styles.mark}>
            <Text size={tokens.typePill.size} weight="bold" style={styles.brokenText}>
              {tokens.marks.broken.glyph}
            </Text>
          </View>
          <Text size={tokens.typeBodyPhone.size} style={[styles.brokenText, styles.fieldErrorText]}>
            {error}
          </Text>
        </View>
      )}
      {help != null && (
        <Text size={tokens.typeSmall.size} style={styles.secondary}>
          {help}
        </Text>
      )}
    </View>
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
        {t('completeProfile.title')}
      </Text>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('completeProfile.intro')}
      </Text>
    </View>
  );
}

/** Sign out is on every gate screen, so a wrong account is never a dead end. */
function SignedInAs({ email }: { email: string }) {
  const { t } = useTranslation();

  async function signOut(): Promise<void> {
    await api.signOut();
    router.replace('/sign-in');
  }

  return (
    <View style={styles.footnote}>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('completeProfile.signedInAs', { email })}
      </Text>
      <Pressable
        style={styles.footnoteAction}
        onPress={() => void signOut()}
        accessibilityRole="button"
        testID="completeProfile.signOut"
      >
        <Text size={tokens.typeBodyPhone.size} weight="semibold" style={styles.accentText}>
          {t('completeProfile.signOut')}
        </Text>
      </Pressable>
    </View>
  );
}

function primary(account: Account): string {
  return account.emailAddresses.find((address) => address.primary)?.address ?? '';
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  pill: {
    height: tokens.sizePill,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  phoneEntry: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  phoneCountry: { flexGrow: 1, flexBasis: 140 },
  phoneNumber: { flexGrow: 2, flexBasis: 180 },
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
  inputWrong: { borderColor: tokens.colorBroken },

  cta: {
    height: tokens.sizeHitPhonePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    backgroundColor: tokens.colorAccent,
  },
  ctaBusy: { backgroundColor: tokens.colorAccentHover },

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
  fieldErrorText: { flex: 1 },

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
