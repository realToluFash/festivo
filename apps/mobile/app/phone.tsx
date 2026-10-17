import { type Account, ApiError } from '@soirely/api-client';
import { deviceRegion, formatPhone, phoneLengthProblem } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { PrimaryButton, QuietButton } from '../src/components/Buttons.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { OnboardingSteps } from '../src/components/OnboardingSteps.tsx';
import { PhoneEntry } from '../src/components/PhoneEntry.tsx';
import { phoneProblemMessage } from '../src/phoneProblem.ts';
import { tokens } from '../src/theme/tokens.ts';

export default function ChangePhone() {
  const { t } = useTranslation();
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
  const device = deviceRegion(
    getLocales()[0]?.regionCode ?? null,
    getLocales().map((locale) => locale.languageTag),
  );

  return (
    <AuthFrame
      saying={
        <>
          {onboarding && <OnboardingSteps at="details" />}
          <AuthHeading
            title={t('verifyPhone.changeTitle')}
            intro={
              current == null
                ? undefined
                : t(current.verified ? 'verifyPhone.nowVerified' : 'verifyPhone.nowUnverified', {
                    number: formatPhone(current.number),
                  })
            }
          />
        </>
      }
    >
      <View style={styles.form}>
        {current != null && <Notice tone="quiet" mark="i" body={t('verifyPhone.changeNotice')} />}

        <NumberForm
          initialCountry={current?.countryCode ?? device ?? ''}
          onTexted={() =>
            router.replace(onboarding ? '/verify-phone?from=onboarding' : '/verify-phone')
          }
        />

        {current != null && (
          <QuietButton
            label={t('verifyPhone.keep')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            testID="phone.keep"
          />
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
    const problem =
      country === ''
        ? t('forms.countryBlank')
        : phoneProblemMessage(phoneLengthProblem(number, country), country, t);

    if (problem != null) {
      setError(problem);

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
      <PhoneEntry
        label={t('verifyPhone.numberLabel')}
        help={t('verifyPhone.numberHelp')}
        country={country}
        error={error}
        disabled={sending}
        onCountry={(code) => {
          setCountry(code);
          setError(null);
        }}
        onNumber={(typed) => {
          setNumber(typed);
          setError(null);
        }}
        onSubmit={() => void send()}
        testID="phone"
      />

      <PrimaryButton
        label={sending ? t('verifyPhone.sending') : t('verifyPhone.send')}
        onPress={() => void send()}
        busy={sending}
        testID="phone.send"
      />
    </>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spaceXl },
});
