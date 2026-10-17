import { ApiError, type Account, awaiting } from '@soirely/api-client';
import {
  deviceRegion,
  followCountry,
  phoneLengthProblem,
  pickPhoneCountry,
  startingPhoneCountry,
} from '@soirely/domain';
import { getCalendars, getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import { Footnote, PrimaryButton } from '../src/components/Buttons.tsx';
import { CountryPicker, focusPicker } from '../src/components/CountryPicker.tsx';
import { Field, TextField } from '../src/components/Field.tsx';
import { LinkedNotice } from '../src/components/LinkedNotice.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { OnboardingSteps } from '../src/components/OnboardingSteps.tsx';
import { PhoneEntry } from '../src/components/PhoneEntry.tsx';
import { landingFor } from '../src/landing.ts';
import { phoneProblemMessage } from '../src/phoneProblem.ts';
import { tokens } from '../src/theme/tokens.ts';

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
  const { t } = useTranslation();
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

  if (account == null) return null;

  const vouched = (name: string) => account.providers.some((p) => p.provider === name);
  const provider = vouched('google') ? 'Google' : vouched('apple') ? 'Apple' : undefined;
  const primaryEmail = account.emailAddresses.find((address) => address.primary)?.address ?? '';

  return (
    <AuthFrame
      saying={
        <>
          <OnboardingSteps at="details" confirmedBy={provider} />
          <AuthHeading title={t('completeProfile.title')} intro={t('completeProfile.intro')} />
        </>
      }
    >
      <LinkedNotice />
      {provider != null && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          body={t('completeProfile.providerConfirmed', { provider, email: primaryEmail })}
        />
      )}
      <Details account={account} />
      <SignedInAs
        email={account.emailAddresses.find((address) => address.primary)?.address ?? ''}
      />
    </AuthFrame>
  );
}

function Details({ account }: { account: Account }) {
  const { t } = useTranslation();
  const [name, setName] = useState(account.name);
  const [organisationName, setOrganisationName] = useState('');
  const [countryCode, setCountryCode] = useState(
    () =>
      deviceRegion(
        getLocales()[0]?.regionCode ?? null,
        getLocales().map((locale) => locale.languageTag),
      ) ?? '',
  );
  const [phone, setPhone] = useState(() =>
    startingPhoneCountry(
      account.needsOrganisation ? countryCode : null,
      account.organisationCountry,
      countryCode,
    ),
  );
  const phoneCountryCode = phone.code;
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const nameInput = useRef<TextInput>(null);
  const organisationInput = useRef<TextInput>(null);
  const phoneInput = useRef<TextInput>(null);
  const countryPicker = useRef<View>(null);

  const asksForOrganisation = account.needsOrganisation;

  async function save(): Promise<void> {
    if (saving) return;

    // Checked before sending, every field at once, and the first that needs attention is focused.
    const checked: Errors = {};
    if (name.trim() === '') checked.name = t('completeProfile.nameBlank');
    if (asksForOrganisation && organisationName.trim() === '') {
      checked.organisationName = t('completeProfile.organisationBlank');
    }
    // Nothing named a country, so the field started blank: the person chooses rather than us guessing.
    if (asksForOrganisation && countryCode === '') checked.countryCode = t('forms.countryBlank');
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

      if (checked.name == null && checked.organisationName == null && checked.countryCode != null) {
        focusPicker(countryPicker);

        return;
      }

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

      // A changed number is texted even while the account still counts as verified.
      router.replace(
        saved.verificationNeeded
          ? '/verify-phone?from=onboarding'
          : landingFor(awaiting(saved.account)),
      );
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
        <TextField
          ref={nameInput}
          wrong={errors.name != null}
          editable={!saving}
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
            <TextField
              ref={organisationInput}
              wrong={errors.organisationName != null}
              editable={!saving}
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
              submitBehavior="submit"
              onSubmitEditing={() => phoneInput.current?.focus()}
              accessibilityLabel={t('completeProfile.organisation')}
              testID="completeProfile.organisation"
            />
          </Field>

          <Field label={t('completeProfile.country')} error={errors.countryCode ?? errors.timezone}>
            <CountryPicker
              label={t('completeProfile.country')}
              value={countryCode}
              onChange={(code) => {
                setCountryCode(code);
                // The code follows the Country until the person picks one themselves (sc-485).
                setPhone((now) => followCountry(now, code));
                // A chosen Country answers its own refusal, and the number's when the code follows it.
                setErrors((previous) => ({
                  ...previous,
                  countryCode: undefined,
                  phoneNumber: phone.picked ? previous.phoneNumber : undefined,
                }));
              }}
              disabled={saving}
              pickerRef={countryPicker}
              testID="completeProfile.country"
            />
          </Field>
        </>
      )}

      <PhoneEntry
        ref={phoneInput}
        label={t('verifyPhone.numberLabel')}
        pill={t('completeProfile.optional')}
        help={t('completeProfile.mobileHelp')}
        country={phoneCountryCode}
        error={errors.phoneNumber ?? errors.phoneCountryCode}
        disabled={saving}
        onCountry={(code) => {
          setPhone(pickPhoneCountry(code));
          setErrors((previous) => ({
            ...previous,
            phoneCountryCode: undefined,
            phoneNumber: undefined,
          }));
        }}
        onNumber={(typed) => {
          setPhoneNumber(typed);
          setErrors((previous) => ({ ...previous, phoneNumber: undefined }));
        }}
        onSubmit={() => void save()}
        testID="completeProfile.phone"
      />

      <PrimaryButton
        label={saving ? t('completeProfile.saving') : t('completeProfile.save')}
        onPress={() => void save()}
        busy={saving}
        testID="completeProfile.save"
      />
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
    <Footnote
      question={t('completeProfile.signedInAs', { email })}
      action={t('completeProfile.signOut')}
      onPress={() => void signOut()}
      testID="completeProfile.signOut"
    />
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spaceXl },
});
