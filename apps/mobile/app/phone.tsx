import { type Account, ApiError } from '@soirely/api-client';
import { countryChoices, deviceCountry, formatPhone, phoneLengthProblem } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, authTitleSize } from '../src/components/AuthFrame.tsx';
import { CountryPicker } from '../src/components/CountryPicker.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { OnboardingSteps } from '../src/components/OnboardingSteps.tsx';
import { Text } from '../src/components/Text.tsx';
import { currentLocale } from '../src/i18n/index.ts';
import { useLayout } from '../src/layout/useLayout.ts';
import { tokens } from '../src/theme/tokens.ts';

const CONTROL_TEXT_SIZE = 16;

export default function ChangePhone() {
  const { t } = useTranslation();
  const titleSize = authTitleSize(useLayout().kind);
  const { from } = useLocalSearchParams<{ from?: string }>();
  const onboarding = from === 'onboarding';
  const [account, setAccount] = useState<Account | 'none' | null>(null);

  useEffect(() => {
    let live = true;

    api
      .me()
      .then((me) => {
        if (live) setAccount(me);
      })
      .catch(() => {
        if (live) setAccount('none');
      });

    return () => {
      live = false;
    };
  }, []);

  if (account === 'none') return <Redirect href="/sign-in" />;
  if (account == null) return null;

  const current = account.phoneNumbers.find((phone) => phone.primary) ?? null;
  const device = deviceCountry(getLocales().map((locale) => locale.languageTag));

  return (
    <AuthFrame
      saying={
        <>
          {onboarding && <OnboardingSteps at="details" />}
          <View style={styles.heading}>
            <Text size={titleSize} weight="bold" style={styles.title} accessibilityRole="header">
              {t('verifyPhone.changeTitle')}
            </Text>
            {current != null && (
              <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
                {t(current.verified ? 'verifyPhone.nowVerified' : 'verifyPhone.nowUnverified', {
                  number: formatPhone(current.number),
                })}
              </Text>
            )}
          </View>
        </>
      }
    >
      <View style={styles.form}>
        {current != null && <Notice tone="quiet" mark="i" body={t('verifyPhone.changeNotice')} />}

        <NumberForm
          initialCountry={current?.countryCode ?? device ?? 'NG'}
          onTexted={() =>
            router.replace(onboarding ? '/verify-phone?from=onboarding' : '/verify-phone')
          }
        />

        {current != null && (
          <Pressable
            style={styles.quietButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            testID="phone.keep"
          >
            <Text size={tokens.typeButton.size} weight="semibold" style={styles.accentInk}>
              {t('verifyPhone.keep')}
            </Text>
          </Pressable>
        )}
      </View>
    </AuthFrame>
  );
}

function NumberForm({
  initialCountry,
  onTexted,
}: {
  initialCountry: string;
  onTexted: () => void;
}) {
  const { t } = useTranslation();
  const [country, setCountry] = useState(initialCountry);
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send(): Promise<void> {
    const problem = phoneLengthProblem(number, country);

    if (problem != null) {
      const name =
        countryChoices(currentLocale()).find(({ code }) => code === country)?.name ?? country;

      setError(
        problem === 'blank'
          ? t('verifyPhone.numberBlank')
          : t(problem === 'tooShort' ? 'verifyPhone.tooShort' : 'verifyPhone.tooLong', {
              country: name,
            }),
      );

      return;
    }

    setSending(true);

    try {
      await api.setPhone(country, number);
      onTexted();
    } catch (refusal) {
      setSending(false);

      if (refusal instanceof ApiError && refusal.is('phone_taken')) {
        setError(t('verifyPhone.taken'));
      } else if (refusal instanceof ApiError && refusal.is('validation_failed')) {
        setError(Object.values(refusal.fieldErrors())[0] ?? t('verifyPhone.failedBody'));
      } else {
        setError(t('verifyPhone.failedBody'));
      }
    }
  }

  return (
    <>
      <View style={styles.entry}>
        <View style={[styles.field, styles.countryField]}>
          <Text size={tokens.typeButton.size} weight="semibold">
            {t('verifyPhone.countryLabel')}
          </Text>
          <CountryPicker
            label={t('verifyPhone.countryLabel')}
            value={country}
            onChange={(code) => {
              setCountry(code);
              setError(null);
            }}
            disabled={sending}
            withCallingCode
            testID="phone.country"
          />
        </View>

        <View style={[styles.field, styles.numberField]}>
          <Text size={tokens.typeButton.size} weight="semibold">
            {t('verifyPhone.numberLabel')}
          </Text>
          <TextInput
            style={[styles.input, error != null && styles.inputWrong]}
            value={number}
            editable={!sending}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="send"
            onChangeText={(text) => {
              setNumber(text);
              setError(null);
            }}
            onSubmitEditing={() => void send()}
            cursorColor={tokens.colorInk}
            selectionColor={tokens.colorInk}
            accessibilityLabel={t('verifyPhone.numberLabel')}
            testID="phone.number"
          />
        </View>
      </View>

      {error != null && (
        <View style={styles.fieldError} accessibilityLiveRegion="polite">
          <View style={styles.mark}>
            <Text size={tokens.typePill.size} weight="bold" style={styles.brokenInk}>
              {tokens.marks.broken.glyph}
            </Text>
          </View>
          <Text size={tokens.typeBodyPhone.size} style={[styles.brokenInk, styles.grow]}>
            {error}
          </Text>
        </View>
      )}

      <Text size={tokens.typeSmall.size} style={styles.secondary}>
        {t('verifyPhone.numberHelp')}
      </Text>

      <Pressable
        style={[styles.cta, sending && styles.ctaOff]}
        onPress={() => void send()}
        disabled={sending}
        accessibilityRole="button"
        testID="phone.send"
      >
        <Text
          size={CONTROL_TEXT_SIZE}
          weight="semibold"
          style={sending ? styles.secondary : styles.onAccent}
        >
          {sending ? t('verifyPhone.sending') : t('verifyPhone.send')}
        </Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { gap: tokens.spaceXs },
  title: { letterSpacing: -0.5 },
  secondary: { color: tokens.colorInkSecondary },
  accentInk: { color: tokens.colorAccentText },
  brokenInk: { color: tokens.colorBrokenText },
  onAccent: { color: tokens.colorInkOnDark },
  grow: { flex: 1 },

  form: { gap: tokens.spaceXl },
  entry: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  field: { gap: tokens.spaceXs },
  countryField: { flexGrow: 1, flexBasis: 140 },
  numberField: { flexGrow: 2, flexBasis: 180 },

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
  ctaOff: { backgroundColor: tokens.colorBorder },
  quietButton: { minHeight: tokens.sizeHit, alignItems: 'center', justifyContent: 'center' },

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
});
