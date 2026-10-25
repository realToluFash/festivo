import { ApiError, type Account, type JoinOffers, awaiting } from '@soirely/api-client';
import {
  answeringInvitation,
  deviceRegion,
  followCountry,
  formatDay,
  formatTimeOfDay,
  phoneLengthProblem,
  pickPhoneCountry,
  startingPhoneCountry,
  waitingInvitations,
} from '@soirely/domain';
import { getCalendars, getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import {
  Footnote,
  PrimaryButton,
  QuietButton,
  SecondaryButton,
} from '../src/components/Buttons.tsx';
import { CountryPicker, focusPicker } from '../src/components/CountryPicker.tsx';
import { Field, TextField } from '../src/components/Field.tsx';
import { InvitationRows } from '../src/components/InvitationRows.tsx';
import { LinkedNotice } from '../src/components/LinkedNotice.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { OnboardingSteps } from '../src/components/OnboardingSteps.tsx';
import { PhoneEntry } from '../src/components/PhoneEntry.tsx';
import { Text } from '../src/components/Text.tsx';
import { dateLocale } from '../src/i18n/index.ts';
import { type WaitingInvitations, useInvitationsOnOpen } from '../src/invitations.ts';
import { landingFor } from '../src/landing.ts';
import { useLayout } from '../src/layout/useLayout.ts';
import { phoneProblemMessage } from '../src/phoneProblem.ts';
import { rememberOrganisation } from '../src/signedIn.ts';
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
  // Start my own organisation instead: the request withdrawn, the organisation fields alone.
  const [founding, setFounding] = useState(false);

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

  if (account.waitingFor != null || founding) {
    const request = account.waitingFor;

    return (
      <AuthFrame
        saying={
          <>
            <OnboardingSteps at="details" confirmedBy={provider} />
            {request != null ? (
              <AuthHeading
                title={t('domainJoining.waitingTitle', {
                  organisation: request.organisation.name,
                })}
                intro={t('domainJoining.waitingIntro', { email: primaryEmail })}
              />
            ) : (
              <AuthHeading title={t('completeProfile.title')} intro={t('completeProfile.intro')} />
            )}
          </>
        }
      >
        {request != null ? (
          <Waiting
            organisation={request.organisation.name}
            asked={t('domainJoining.asked', {
              day: formatDay(request.askedAt, dateLocale()),
              time: formatTimeOfDay(request.askedAt, dateLocale()),
            })}
            onWithdrawn={() => {
              setFounding(true);
              setAccount({ ...account, waitingFor: null });
            }}
          />
        ) : (
          <FoundOrganisation />
        )}
        <SignedInAs email={primaryEmail} />
      </AuthFrame>
    );
  }

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
      <Details account={account} onAsked={setAccount} />
      <SignedInAs
        email={account.emailAddresses.find((address) => address.primary)?.address ?? ''}
      />
    </AuthFrame>
  );
}

function Waiting({
  organisation,
  asked,
  onWithdrawn,
}: {
  organisation: string;
  asked: string;
  onWithdrawn: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<object | null>(null);

  async function startOwn(): Promise<void> {
    if (busy) return;

    setBusy(true);
    setFailed(null);

    try {
      await api.withdrawJoinRequest();
      onWithdrawn();
    } catch {
      setBusy(false);
      setFailed({});
    }
  }

  return (
    <View style={styles.form}>
      {failed != null && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('completeProfile.failedTitle')}
          body={t('completeProfile.failedBody')}
          announce
          answers={failed}
        />
      )}
      <Notice
        tone="attention"
        mark={tokens.marks.progress.glyph}
        title={t('domainJoining.waiting')}
        body={asked}
      />
      <Text size={tokens.typeBodyPhone.size}>
        {t('domainJoining.waitingBody', { organisation })}
      </Text>
      <SecondaryButton
        label={t('domainJoining.startOwnInstead')}
        off={busy}
        onPress={() => void startOwn()}
        testID="completeProfile.startOwnInstead"
      />
    </View>
  );
}

/** After withdrawing: the organisation the details screen would have founded, through POST /api/orgs. */
function FoundOrganisation() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState(
    () =>
      deviceRegion(
        getLocales()[0]?.regionCode ?? null,
        getLocales().map((locale) => locale.languageTag),
      ) ?? '',
  );
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<object | null>(null);
  const nameInput = useRef<TextInput>(null);
  const countryPicker = useRef<View>(null);

  async function found(): Promise<void> {
    if (saving) return;

    const checked: Errors = {};
    if (name.trim() === '') checked.organisationName = t('completeProfile.organisationBlank');
    if (countryCode === '') checked.countryCode = t('forms.countryBlank');

    if (Object.keys(checked).length > 0) {
      setErrors(checked);
      if (checked.organisationName != null) nameInput.current?.focus();
      else focusPicker(countryPicker);
      return;
    }

    setSaving(true);
    setFailed(null);

    try {
      await api.createOrganisation({
        name: name.trim(),
        countryCode,
        timezone: getCalendars()[0]?.timeZone ?? 'UTC',
      });
      router.replace('/');
    } catch (error) {
      setSaving(false);

      if (error instanceof ApiError && error.is('validation_failed')) {
        const fields = error.fieldErrors();
        setErrors({
          organisationName: fields.name,
          countryCode: fields.countryCode,
          timezone: fields.timezone,
        });
        return;
      }

      setFailed({});
    }
  }

  return (
    <View style={styles.form}>
      {failed != null && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('completeProfile.failedTitle')}
          body={t('completeProfile.failedBody')}
          announce
          answers={failed}
        />
      )}
      <Field
        label={t('completeProfile.organisation')}
        error={errors.organisationName}
        help={t('completeProfile.organisationHelp')}
      >
        <TextField
          ref={nameInput}
          wrong={errors.organisationName != null}
          editable={!saving}
          value={name}
          maxLength={ORGANISATION_NAME_MAXIMUM}
          onChangeText={(text) => {
            setName(text);
            setErrors((previous) => ({ ...previous, organisationName: undefined }));
          }}
          autoComplete="organization"
          textContentType="organizationName"
          autoCapitalize="words"
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
            setErrors((previous) => ({ ...previous, countryCode: undefined }));
          }}
          disabled={saving}
          pickerRef={countryPicker}
          testID="completeProfile.country"
        />
      </Field>
      <PrimaryButton
        label={saving ? t('completeProfile.saving') : t('completeProfile.save')}
        onPress={() => void found()}
        busy={saving}
        testID="completeProfile.save"
      />
    </View>
  );
}

function Details({ account, onAsked }: { account: Account; onAsked: (account: Account) => void }) {
  const { t } = useTranslation();
  const { kind } = useLayout();
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
  const [failed, setFailed] = useState<object | null>(null);
  const nameInput = useRef<TextInput>(null);
  const organisationInput = useRef<TextInput>(null);
  const phoneInput = useRef<TextInput>(null);
  const countryPicker = useRef<View>(null);

  // Read once, when the screen opens asking for an organisation; the rows stay until the person leaves (sc-3353).
  const loaded = useInvitationsOnOpen(account.needsOrganisation);
  // Finishing lands in the first one accepted; another is a membership reached from the switcher.
  const [firstJoined, setFirstJoined] = useState<string | null>(null);
  const waiting: WaitingInvitations = {
    ...loaded,
    answer: async (invitation, choice) => {
      const outcome = await loaded.answer(invitation, choice);
      if (outcome.kind === 'accepted') setFirstJoined((first) => first ?? outcome.organisationId);

      return outcome;
    },
  };
  const stillOpen = waitingInvitations(loaded.invitations, loaded.outcomes);
  const needsOne = account.needsOrganisation && firstJoined == null;
  const answering = answeringInvitation(loaded.outcomes);

  // Only a self-registered account in no organisation is offered one at its domain (sc-561).
  const [offered, setOffered] = useState<JoinOffers | null>(null);
  const [own, setOwn] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!account.needsOrganisation) return;

    let live = true;
    api.joinOffers().then(
      (found) => {
        if (live) setOffered(found);
      },
      // Without the offers the organisation fields show, as they would with none.
      () => undefined,
    );

    return () => {
      live = false;
    };
  }, [account.needsOrganisation]);

  const offers = offered?.offers ?? [];
  const showOffers = needsOne && offers.length > 0 && !own;
  const asksForOrganisation = needsOne && !showOffers;

  async function save(askToJoin: string | null = null): Promise<void> {
    if (saving || answering) return;
    if (showOffers && askToJoin == null) return;

    const founds = asksForOrganisation && askToJoin == null;
    // Checked before sending, every field at once, and the first that needs attention is focused.
    const checked: Errors = {};
    if (name.trim() === '') checked.name = t('completeProfile.nameBlank');
    if (founds && organisationName.trim() === '') {
      checked.organisationName = t(
        stillOpen > 0
          ? 'completeProfile.organisationOrInvitation'
          : 'completeProfile.organisationBlank',
      );
    }
    // Nothing named a country, so the field started blank: the person chooses rather than us guessing.
    if (founds && countryCode === '') checked.countryCode = t('forms.countryBlank');
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
    setFailed(null);
    setUnavailable(false);

    try {
      const saved = await api.completeProfile({
        name: name.trim(),
        ...(askToJoin != null ? { askToJoin } : {}),
        ...(founds
          ? {
              organisationName: organisationName.trim(),
              countryCode,
              timezone: getCalendars()[0]?.timeZone ?? 'UTC',
            }
          : {}),
        phoneCountryCode,
        phoneNumber: phoneNumber.trim(),
      });

      if (firstJoined != null) await rememberOrganisation(firstJoined);
      // A changed number is texted even while the account still counts as verified.
      if (saved.verificationNeeded) router.replace('/verify-phone?from=onboarding');
      else if (saved.account.waitingFor != null) onAsked(saved.account);
      else router.replace(landingFor(awaiting(saved.account)));
    } catch (error) {
      setSaving(false);

      if (error instanceof ApiError && error.is('join_offer_unavailable')) {
        setOffered(await api.joinOffers().catch(() => null));
        setUnavailable(true);
        return;
      }

      if (error instanceof ApiError && error.is('validation_failed')) {
        setErrors(error.fieldErrors() as Errors);
        return;
      }

      if (error instanceof ApiError && error.is('phone_taken')) {
        setErrors({ phoneNumber: t('verifyPhone.taken') });
        return;
      }

      setFailed({});
    }
  }

  return (
    <View style={styles.form}>
      {failed != null && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          title={t('completeProfile.failedTitle')}
          body={t('completeProfile.failedBody')}
          answers={failed}
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

      {loaded.invitations.length > 0 && (
        <View style={styles.invitations}>
          <View style={styles.invitationsHead}>
            <Text size={tokens.typeButton.size} weight="semibold" accessibilityRole="header">
              {t('invitations.heading')}
            </Text>
            <Text size={tokens.typeSmall.size} muted>
              {firstJoined != null
                ? t('completeProfile.invitationsJoined')
                : stillOpen === 0
                  ? t('completeProfile.invitationsNone')
                  : t('completeProfile.invitationsWaiting', { count: stillOpen })}
            </Text>
          </View>
          <InvitationRows
            waiting={waiting}
            after={{
              note: (id) => {
                const outcome = loaded.outcomes[id];
                const first =
                  outcome?.kind === 'accepted' && outcome.organisationId === firstJoined;

                return t(
                  first ? 'completeProfile.joinedGoesThere' : 'completeProfile.joinedSwitchLater',
                );
              },
            }}
          />
        </View>
      )}

      {needsOne && stillOpen > 0 && (
        <View style={styles.orRule}>
          <View style={styles.rule} />
          <Text size={tokens.typeButton.size} weight="semibold" muted>
            {t('completeProfile.orStartOwn')}
          </Text>
          <View style={styles.rule} />
        </View>
      )}

      {unavailable && (
        <Notice
          tone="broken"
          mark={tokens.marks.broken.glyph}
          body={t('domainJoining.unavailable')}
          announce
        />
      )}

      {showOffers && (
        <View style={styles.offers}>
          <View style={styles.offersIntro}>
            <Text size={tokens.typeButton.size} weight="semibold" accessibilityRole="header">
              {t('domainJoining.heading')}
            </Text>
            <Text size={tokens.typeSmall.size} muted>
              {t('domainJoining.intro', { domain: offered?.domain ?? '' })}
            </Text>
          </View>
          {offers.map((offer) => (
            <View key={offer.id} style={[styles.offer, kind === 'phone' && styles.offerPhone]}>
              <View style={[styles.offerText, kind === 'phone' && styles.offerTextPhone]}>
                <Text size={tokens.typeRowTitle.size} weight="semibold">
                  {t('domainJoining.usesSoirely', { organisation: offer.name })}
                </Text>
                <Text size={tokens.typeSmall.size} muted>
                  {t('domainJoining.approvesFirst')}
                </Text>
              </View>
              {offers.length === 1 ? (
                <PrimaryButton
                  label={t('domainJoining.ask')}
                  accessibilityLabel={t('domainJoining.askLabel', { organisation: offer.name })}
                  busy={saving}
                  onPress={() => void save(offer.id)}
                  testID={`completeProfile.ask.${offer.id}`}
                />
              ) : (
                <SecondaryButton
                  label={t('domainJoining.ask')}
                  accessibilityLabel={t('domainJoining.askLabel', { organisation: offer.name })}
                  off={saving}
                  onPress={() => void save(offer.id)}
                  testID={`completeProfile.ask.${offer.id}`}
                />
              )}
            </View>
          ))}
          <SecondaryButton
            label={t('domainJoining.startOwn')}
            off={saving}
            onPress={() => setOwn(true)}
            testID="completeProfile.startOwn"
          />
        </View>
      )}

      {needsOne && offers.length > 0 && own && (
        <QuietButton
          label={t('domainJoining.askInstead', { domain: offered?.domain ?? '' })}
          onPress={() => setOwn(false)}
          testID="completeProfile.askInstead"
        />
      )}

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

      {!showOffers && (
        <PrimaryButton
          label={saving ? t('completeProfile.saving') : t('completeProfile.save')}
          onPress={() => void save()}
          busy={saving}
          off={answering}
          testID="completeProfile.save"
        />
      )}
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
  invitations: { gap: tokens.spaceMd },
  invitationsHead: { gap: tokens.spaceXxs },
  orRule: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  rule: { flex: 1, height: 1, backgroundColor: tokens.colorInsetBorder },
  offers: { gap: tokens.spaceMd },
  offersIntro: { gap: tokens.spaceXxs },
  offer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  offerText: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0, gap: tokens.spaceHair },
  offerPhone: { flexDirection: 'column', alignItems: 'flex-start' },
  offerTextPhone: { flexBasis: 'auto', alignSelf: 'stretch' },
});
