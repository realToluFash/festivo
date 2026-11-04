import { ApiError, type Account, type JoinOffers, awaiting } from '@soirely/api-client';
import {
  ACCOUNT_NAME_MAXIMUM,
  answeringInvitation,
  deviceRegion,
  formatDay,
  formatTimeOfDay,
  waitingInvitations,
} from '@soirely/domain';
import { getCalendars, getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AnswerHeading } from '../src/components/AnswerHeading.tsx';
import { PrimaryButton, QuietButton, SecondaryButton } from '../src/components/Buttons.tsx';
import { CountryPicker, focusPicker } from '../src/components/CountryPicker.tsx';
import { Field, focusChecked, keysStayDown, TextField } from '../src/components/Field.tsx';
import { InvitationRows } from '../src/components/InvitationRows.tsx';
import { LinkedNotice } from '../src/components/LinkedNotice.tsx';
import { Notice } from '../src/components/Notice.tsx';
import {
  type StepClosed,
  stepClosed,
  useFocusBackToOpener,
  useFocusOnAnswer,
} from '../src/components/Screen.tsx';
import type { ScreenReaderTarget } from '../src/components/screenReaderFocus.ts';
import { Text } from '../src/components/Text.tsx';
import { dateLocale } from '../src/i18n/index.ts';
import { type WaitingInvitations, useInvitationsOnOpen } from '../src/invitations.ts';
import { landingFor } from '../src/landing.ts';
import { useLayout } from '../src/layout/useLayout.ts';
import { rememberOrganisation } from '../src/signedIn.ts';
import { InsideField } from '../src/steps/InsideField.tsx';
import { Heading, Plain, Says } from '../src/steps/Lines.tsx';
import { NavBar, StepScreen } from '../src/steps/StepScreen.tsx';
import { tokens } from '../src/theme/tokens.ts';

/** The API's OrganisationRules::NAME_MAXIMUM. */
const ORGANISATION_NAME_MAXIMUM = 100;

type Errors = Partial<
  Record<'name' | 'organisationName' | 'countryCode' | 'timezone', string | undefined>
>;

/** Your organisation, the third of four steps, or the first of two after Google or Apple. Opens when the API says `profile_incomplete`, or after verifying; your mobile number follows. */
export default function CompleteProfile() {
  const { t } = useTranslation();
  const [account, setAccount] = useState<Account | null>(null);
  // Start my own organisation instead: the request withdrawn, the organisation fields alone.
  const [founding, setFounding] = useState(false);
  // The tap that brought the step showing, for its heading to take screen reader focus.
  const [tapped, setTapped] = useState<object | undefined>(undefined);
  const providerWords = useRef<ViewInstance>(null);
  const nameInput = useRef<TextInputInstance>(null);
  // Dismiss on the linked notice hands focus to the item after it (sc-11173).
  const [linkedClosed, setLinkedClosed] = useState<StepClosed | undefined>(undefined);
  const afterLinked = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return providerWords.current ?? nameInput.current;
      },
    }),
    [],
  );
  useFocusBackToOpener(linkedClosed, afterLinked);

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
  const nav = <OrganisationBar short={provider != null} />;

  if (account.waitingFor != null || founding) {
    const request = account.waitingFor;

    return (
      <StepScreen nav={nav}>
        {request != null ? (
          <Heading
            title={t('domainJoining.waitingTitle', { organisation: request.organisation.name })}
            intro={t('domainJoining.waitingIntro', { email: primaryEmail })}
            answer={tapped}
          />
        ) : (
          <Heading title={t('steps.organisationTitle')} answer={tapped} />
        )}
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
              setTapped({});
            }}
          />
        ) : (
          <FoundOrganisation />
        )}
      </StepScreen>
    );
  }

  return (
    <Details account={account} nav={nav} nameInput={nameInput}>
      <LinkedNotice onDismissed={() => setLinkedClosed(stepClosed('afterLinked'))} />
      {provider != null && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          body={t('completeProfile.providerConfirmed', { provider, email: primaryEmail })}
          wordsRef={providerWords}
        />
      )}
    </Details>
  );
}

/** Back would leave the account, so the bar's left says Sign out. */
function OrganisationBar({ short }: { short: boolean }) {
  const { t } = useTranslation();

  async function signOut(): Promise<void> {
    await api.signOut();
    router.replace('/sign-in');
  }

  return (
    <NavBar
      left={{ label: t('steps.signOut'), onPress: () => void signOut() }}
      onLeft={() => void signOut()}
      step={short ? [1, 2] : [3, 4]}
      testID="completeProfile"
    />
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
          answer={failed}
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
  const nameInput = useRef<TextInputInstance>(null);
  const countryPicker = useRef<ViewInstance>(null);

  async function found(): Promise<void> {
    if (saving) return;

    const checked: Errors = {};
    if (name.trim() === '') checked.organisationName = t('completeProfile.organisationBlank');
    if (countryCode === '') checked.countryCode = t('forms.countryBlank');

    if (Object.keys(checked).length > 0) {
      setErrors(checked);
      if (checked.organisationName != null) focusChecked(nameInput);
      else focusPicker(countryPicker);
      return;
    }

    keysStayDown();
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
          answer={failed}
        />
      )}
      <View style={styles.fields}>
        <Field
          label={t('completeProfile.organisation')}
          error={errors.organisationName}
          help={t('completeProfile.organisationHelp')}
        >
          <TextField
            ref={nameInput}
            wrong={errors.organisationName != null}
            submitting={saving}
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
      </View>
      <PrimaryButton
        label={saving ? t('completeProfile.saving') : t('completeProfile.save')}
        onPress={() => void found()}
        busy={saving}
        testID="completeProfile.save"
      />
    </View>
  );
}

function Details({
  account,
  nav,
  nameInput,
  children,
}: {
  account: Account;
  nav: ReactNode;
  nameInput: RefObject<TextInputInstance | null>;
  /** Notices above the fields. */
  children: ReactNode;
}) {
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
  // Not asked twice: only when the sign-up, or Apple, left it blank.
  const [asksName] = useState(() => account.name.trim() === '');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<object | null>(null);
  const organisationInput = useRef<TextInputInstance>(null);
  const countryPicker = useRef<ViewInstance>(null);

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
  const [askedInstead, setAskedInstead] = useState<object | undefined>(undefined);
  const [unavailable, setUnavailable] = useState<object | null>(null);
  // Start my own organisation brings the organisation fields in its place, so focus goes to the first (sc-11173).
  const [startedOwn, setStartedOwn] = useState<object | undefined>(undefined);
  useFocusOnAnswer<TextInputInstance>(startedOwn, organisationInput);

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

    if (Object.keys(checked).length > 0) {
      setErrors(checked);

      if (checked.name == null && checked.organisationName == null && checked.countryCode != null) {
        focusPicker(countryPicker);

        return;
      }

      focusChecked(checked.name != null ? nameInput : organisationInput);
      return;
    }

    keysStayDown();
    setSaving(true);
    setFailed(null);
    setUnavailable(null);

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
      });

      if (firstJoined != null) await rememberOrganisation(firstJoined);
      // The number is saved on a step of its own, which Skip passes; a request to join waits after it.
      if (saved.account.waitingFor != null || awaiting(saved.account) == null) {
        router.replace('/phone?from=onboarding');
      } else router.replace(landingFor(awaiting(saved.account)));
    } catch (error) {
      setSaving(false);

      if (error instanceof ApiError && error.is('join_offer_unavailable')) {
        setOffered(await api.joinOffers().catch(() => null));
        setUnavailable({});
        return;
      }

      if (error instanceof ApiError && error.is('validation_failed')) {
        setErrors(error.fieldErrors() as Errors);
        return;
      }

      setFailed({});
    }
  }

  return (
    <StepScreen
      nav={nav}
      foot={
        showOffers ? undefined : (
          <PrimaryButton
            label={saving ? t('completeProfile.saving') : t('steps.continue')}
            onPress={() => void save()}
            busy={saving}
            off={answering}
            testID="completeProfile.save"
          />
        )
      }
    >
      <Heading title={t('steps.organisationTitle')} />
      <View style={styles.form}>
        {children}
        {failed != null && (
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            title={t('completeProfile.failedTitle')}
            body={t('completeProfile.failedBody')}
            answer={failed}
          />
        )}

        {asksName && (
          <View>
            <InsideField
              ref={nameInput}
              label={t('completeProfile.name')}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setErrors((previous) => ({ ...previous, name: undefined }));
              }}
              state={errors.name != null ? 'blank' : 'plain'}
              submitting={saving}
              autoComplete="name"
              textContentType="name"
              autoCapitalize="words"
              maxLength={ACCOUNT_NAME_MAXIMUM}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => organisationInput.current?.focus()}
              testID="completeProfile.name"
            />
            {errors.name != null && <Says words={errors.name} />}
          </View>
        )}

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

        {unavailable != null && (
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            body={t('domainJoining.unavailable')}
            answer={unavailable}
            takesFocus
          />
        )}

        {showOffers && (
          <View style={styles.offers}>
            <View style={styles.offersIntro}>
              <AnswerHeading size={tokens.typeButton.size} weight="semibold" answer={askedInstead}>
                {t('domainJoining.heading')}
              </AnswerHeading>
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
              onPress={() => {
                setOwn(true);
                setAskedInstead(undefined);
                setStartedOwn({});
              }}
              testID="completeProfile.startOwn"
            />
          </View>
        )}

        {needsOne && offers.length > 0 && own && (
          <QuietButton
            label={t('domainJoining.askInstead', { domain: offered?.domain ?? '' })}
            onPress={() => {
              setOwn(false);
              setStartedOwn(undefined);
              setAskedInstead({});
            }}
            testID="completeProfile.askInstead"
          />
        )}

        {asksForOrganisation && (
          <View style={styles.fields}>
            <View>
              <InsideField
                ref={organisationInput}
                label={t('completeProfile.organisation')}
                value={organisationName}
                onChangeText={(text) => {
                  setOrganisationName(text);
                  setErrors((previous) => ({ ...previous, organisationName: undefined }));
                }}
                state={errors.organisationName != null ? 'blank' : 'plain'}
                submitting={saving}
                maxLength={ORGANISATION_NAME_MAXIMUM}
                autoComplete="organization"
                textContentType="organizationName"
                autoCapitalize="words"
                returnKeyType="done"
                autoFocus={!asksName && stillOpen === 0}
                testID="completeProfile.organisation"
              />
              {errors.organisationName != null && <Says words={errors.organisationName} />}
              <Plain>{t('completeProfile.organisationHelp')}</Plain>
            </View>

            <Field
              label={t('completeProfile.country')}
              error={errors.countryCode ?? errors.timezone}
            >
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
          </View>
        )}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.space3xl },
  fields: { gap: tokens.spaceXl },
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
