import { type Account, ApiError } from '@soirely/api-client';
import {
  deviceRegion,
  formatPhone,
  phoneLengthProblem,
  phoneScreenCountry,
  refusedPhoneField,
} from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { PrimaryButton, QuietButton } from '../src/components/Buttons.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { CountryPicker, focusPicker } from '../src/components/CountryPicker.tsx';
import { focusChecked, keysStayDown } from '../src/components/Field.tsx';
import { PhoneEntry } from '../src/components/PhoneEntry.tsx';
import { AboveKeyboardView } from '../src/components/Screen.tsx';
import { phoneProblemMessage } from '../src/phoneProblem.ts';
import { InsideField } from '../src/steps/InsideField.tsx';
import { skipPhone } from '../src/steps/skipPhone.ts';
import { Heading, Plain, Says } from '../src/steps/Lines.tsx';
import { NavBar, StepScreen } from '../src/steps/StepScreen.tsx';
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

  if (onboarding) {
    const short = account.providers.some(
      (one) => one.provider === 'google' || one.provider === 'apple',
    );

    return <MobileStep initialCountry={phoneScreenCountry(account, device)} short={short} />;
  }

  return (
    <AuthFrame
      saying={
        <>
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
      <>
        {current != null && <Notice tone="quiet" mark="i" body={t('verifyPhone.changeNotice')} />}

        <NumberForm
          initialCountry={phoneScreenCountry(account, device)}
          onTexted={() => router.replace('/verify-phone')}
        />

        {current != null && (
          <QuietButton
            label={t('verifyPhone.keep')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            testID="phone.keep"
          />
        )}
      </>
    </AuthFrame>
  );
}

/** The last step, which Skip at the top right passes, saving no number. */
function MobileStep({ initialCountry, short }: { initialCountry: string; short: boolean }) {
  const { t } = useTranslation();
  const [country, setCountry] = useState(initialCountry);
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const numberInput = useRef<TextInputInstance>(null);
  const countryPicker = useRef<ViewInstance>(null);
  const { send, errorOn, refuse } = useSend(
    country,
    number,
    sending,
    setError,
    setSending,
    numberInput,
    countryPicker,
    () => router.push('/verify-phone?from=onboarding'),
  );

  return (
    <StepScreen
      nav={
        <NavBar
          left={null}
          onLeft={() => {}}
          step={short ? [2, 2] : [4, 4]}
          right={{
            label: t('steps.skip'),
            onPress: () => void skipPhone().catch(() => refuse(t('verifyPhone.failedBody'))),
          }}
          testID="phone"
        />
      }
      foot={
        <PrimaryButton
          label={sending ? t('verifyPhone.sending') : t('steps.sendCode')}
          onPress={() => void send()}
          busy={sending}
          testID="phone.send"
        />
      }
    >
      <Heading title={t('steps.mobileTitle')} intro={t('steps.mobileIntro')} />
      <AboveKeyboardView>
        <View style={styles.row}>
          <CountryPicker
            label={t('verifyPhone.countryLabel')}
            value={country}
            onChange={(code) => {
              setCountry(code);
              setError(null);
            }}
            disabled={sending}
            withCallingCode
            compact
            wrong={error != null && errorOn === 'country'}
            pickerRef={countryPicker}
            testID="phone.country"
          />
          <View style={styles.number}>
            <InsideField
              ref={numberInput}
              label={t('verifyPhone.numberLabel')}
              value={number}
              onChangeText={(typed) => {
                setNumber(typed);
                setError(null);
              }}
              state={error != null && errorOn === 'number' ? 'blank' : 'plain'}
              submitting={sending}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              returnKeyType="done"
              submitBehavior="submit"
              onSubmitEditing={() => void send()}
              autoFocus
              testID="phone.number"
            />
          </View>
        </View>
        {error != null && <Says words={error} />}
      </AboveKeyboardView>
      <Plain>{t('steps.mobileLine')}</Plain>
    </StepScreen>
  );
}

/** Checked before sending, then texted: the refusal says which field to fix. */
function useSend(
  country: string,
  number: string,
  sending: boolean,
  setError: (words: string | null) => void,
  setSending: (sending: boolean) => void,
  numberInput: RefObject<TextInputInstance | null>,
  countryPicker: RefObject<ViewInstance | null>,
  onTexted: () => void,
) {
  const { t } = useTranslation();
  const [errorOn, setErrorOn] = useState<'country' | 'number'>('number');

  async function send(): Promise<void> {
    if (sending) return;

    const found = phoneLengthProblem(number, country);
    const problem = phoneProblemMessage(found, country, t);
    const on = refusedPhoneField(found) ?? 'number';
    setErrorOn(on);

    if (problem != null) {
      setError(problem);
      if (on === 'country') focusPicker(countryPicker);
      else focusChecked(numberInput);

      return;
    }

    keysStayDown();
    setSending(true);

    try {
      await api.setPhone(country, number);
      onTexted();
    } catch (refusal) {
      if (refusal instanceof ApiError && refusal.is('phone_taken')) {
        setError(t('verifyPhone.taken'));
      } else if (refusal instanceof ApiError && refusal.is('validation_failed')) {
        setError(Object.values(refusal.fieldErrors())[0] ?? t('verifyPhone.failedBody'));
      } else {
        setError(t('verifyPhone.failedBody'));
      }
    } finally {
      setSending(false);
    }
  }

  function refuse(words: string): void {
    setErrorOn('number');
    setError(words);
  }

  return { send, errorOn, refuse };
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
  const numberInput = useRef<TextInputInstance>(null);
  const countryPicker = useRef<ViewInstance>(null);

  const { send, errorOn } = useSend(
    country,
    number,
    sending,
    setError,
    setSending,
    numberInput,
    countryPicker,
    onTexted,
  );

  return (
    <>
      <PhoneEntry
        label={t('verifyPhone.numberLabel')}
        help={t('verifyPhone.numberHelp')}
        country={country}
        error={error}
        errorOn={errorOn}
        submitting={sending}
        onCountry={(code) => {
          setCountry(code);
          setError(null);
        }}
        onNumber={(typed) => {
          setNumber(typed);
          setError(null);
        }}
        onSubmit={() => void send()}
        ref={numberInput}
        pickerRef={countryPicker}
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
  row: {
    marginTop: tokens.space3xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
  },
  number: { flex: 1 },
});
