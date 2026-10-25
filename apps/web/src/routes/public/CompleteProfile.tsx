import { ApiError, type JoinOffers, type JoinRequest } from '@soirely/api-client';
import {
  answeringInvitation,
  countryChoices,
  deviceCountry,
  followCountry,
  formatDay,
  formatTimeOfDay,
  phoneLengthProblem,
  pickPhoneCountry,
  startingPhoneCountry,
  waitingInvitations,
} from '@soirely/domain';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { FieldError } from '../../components/FieldError.tsx';
import { InvitationRows } from '../../components/InvitationRows.tsx';
import { LinkedNotice } from '../../components/LinkedNotice.tsx';
import { AuthPage } from '../../components/AuthPage.tsx';
import { Pending } from '../../components/Pending.tsx';
import { PhoneEntry } from '../../components/PhoneEntry.tsx';
import { StillSignedIn } from '../../components/StillSignedIn.tsx';
import { Unreachable } from '../../components/Unreachable.tsx';
import { currentLocale, dateLocale } from '../../i18n/index.ts';
import { useWaitingInvitations } from '../../invitations.ts';
import { phoneProblemMessage } from '../../phoneProblem.ts';
import {
  adoptAccount,
  landingFor,
  rememberOrganisation,
  restoreSession,
  useSessionState,
} from '../../session.ts';
import { useSignOut } from '../../signOut.ts';

type Field =
  'name' | 'organisationName' | 'countryCode' | 'timezone' | 'phoneCountryCode' | 'phoneNumber';
type Errors = Partial<Record<Field, string>>;

/** The second gate. Reached when the API says `profile_incomplete`, or straight after verifying. */
export function CompleteProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut, unreached } = useSignOut(() => navigate('/sign-in'));
  const state = useSessionState();

  useEffect(() => {
    void restoreSession();
  }, []);

  if (state.status === 'signedOut') return <Navigate to="/sign-in" replace />;
  if (state.status === 'unreachable') return <Unreachable signedIn />;
  if (state.status !== 'signedIn') return <Pending />;

  // Only the gate it is behind: an unverified account verifies first, a complete one is let in.
  const landing = landingFor(state.session.awaiting);
  const vouched = (name: string) => state.session.providers.some((p) => p.provider === name);
  const provider = vouched('google') ? 'Google' : vouched('apple') ? 'Apple' : null;
  if (landing !== '/complete-profile') return <Navigate to={landing} replace />;

  return (
    <AuthPage>
      <ol className="steps" aria-label={t('verifyEmail.stepsLabel')}>
        <li className="step step-done">
          <span className="step-mark" aria-hidden="true">
            ✓
          </span>
          {provider != null
            ? t('verifyEmail.step1Google', { provider })
            : t('verifyEmail.step1Done')}
        </li>
        <li className="step step-now">
          <span className="step-mark" aria-hidden="true">
            2
          </span>
          {t('verifyEmail.step2')}
        </li>
      </ol>

      <LinkedNotice />

      {state.session.waitingFor != null ? (
        <Waiting request={state.session.waitingFor} email={state.session.email} />
      ) : (
        <>
          <div className="auth-heading">
            <h1>{t('completeProfile.title')}</h1>
            <p>{t('completeProfile.intro')}</p>
          </div>

          {provider != null && (
            <div className="notice notice-quiet" role="status">
              <span className="mark mark-info" aria-hidden="true">
                i
              </span>
              <p>
                {t('completeProfile.providerConfirmed', {
                  provider,
                  email: state.session.email,
                })}
              </p>
            </div>
          )}

          <Details
            name={state.session.name}
            needsOrganisation={state.session.needsOrganisation}
            organisationCountry={
              state.session.organisation?.countryCode ?? state.session.organisationCountry
            }
            onSaved={(verificationNeeded, asked) => {
              // A phone to verify comes first; after it, an account that asked lands back here, waiting.
              if (verificationNeeded) navigate('/verify-phone?from=onboarding', { replace: true });
              else if (!asked) navigate('/app', { replace: true });
            }}
          />
        </>
      )}

      {unreached && <StillSignedIn />}

      <div className="auth-footnote">
        <span>{t('completeProfile.signedInAs', { email: state.session.email })}</span>
        <button className="link-button" type="button" onClick={() => void signOut()}>
          {t('completeProfile.signOut')}
        </button>
      </div>
    </AuthPage>
  );
}

/** Asked to join at its domain, with nothing of that organisation's to see until somebody approves. */
function Waiting({ request, email }: { request: JoinRequest; email: string }) {
  const { t } = useTranslation();
  const [withdrawing, setWithdrawing] = useState(false);
  const [failed, setFailed] = useState(false);
  const organisation = request.organisation.name;
  const locale = dateLocale();

  async function startOwn(): Promise<void> {
    setWithdrawing(true);
    setFailed(false);

    try {
      await api.withdrawJoinRequest();
      // Through the gate now: the product's no-organisation screen is where one is started.
      await adoptAccount(await api.me());
    } catch {
      setWithdrawing(false);
      setFailed(true);
    }
  }

  return (
    <>
      <div className="auth-heading">
        <h1>{t('domainJoining.waitingTitle', { organisation })}</h1>
        <p>{t('domainJoining.waitingIntro', { email })}</p>
      </div>

      {failed && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('completeProfile.failedTitle')}</p>
            <p>{t('completeProfile.failedBody')}</p>
          </div>
        </div>
      )}

      <div className="notice notice-attention" role="status">
        <span className="mark mark-attention" aria-hidden="true">
          …
        </span>
        <p>
          <strong>{t('domainJoining.waiting')}</strong>
          {' · '}
          {t('domainJoining.asked', {
            day: formatDay(request.askedAt, locale),
            time: formatTimeOfDay(request.askedAt, locale),
          })}
        </p>
      </div>

      <p>{t('domainJoining.waitingBody', { organisation })}</p>

      <button
        className="button"
        type="button"
        aria-busy={withdrawing}
        disabled={withdrawing}
        onClick={() => void startOwn()}
      >
        {t('domainJoining.startOwnInstead')}
      </button>
    </>
  );
}

function Details({
  name,
  needsOrganisation,
  organisationCountry,
  onSaved,
}: {
  name: string;
  needsOrganisation: boolean;
  organisationCountry: string | null;
  onSaved: (verificationNeeded: boolean, asked: boolean) => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const countries = useMemo(() => countryChoices(locale), [locale]);
  const [values, setValues] = useState(() => {
    // A browser exposes no Region setting, so its languages decide, and nothing named means blank.
    const country = deviceCountry(navigator.languages) ?? '';

    return {
      name,
      organisationName: '',
      countryCode: country,
      phoneCountryCode: startingPhoneCountry(
        needsOrganisation ? country : null,
        organisationCountry,
        country,
      ).code,
      phoneNumber: '',
    };
  });
  // The code follows the Country until the person picks one themselves (sc-485).
  const [phonePicked, setPhonePicked] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // Read once, when the page opens asking for an organisation; the rows stay until the person leaves (sc-3353).
  const waiting = useWaitingInvitations(needsOrganisation);
  // Finishing lands in the first one accepted; another is a membership reached from the switcher.
  const firstJoined = waiting.firstJoined;
  const stillOpen = waitingInvitations(waiting.invitations, waiting.outcomes);
  const asksForOrganisation = needsOrganisation && firstJoined == null;
  const answering = answeringInvitation(waiting.outcomes);
  const nameInput = useRef<HTMLInputElement>(null);
  const organisationInput = useRef<HTMLInputElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const countryInput = useRef<HTMLSelectElement>(null);
  // Only a self-registered account in no organisation is offered one at its domain (sc-561).
  const [offered, setOffered] = useState<JoinOffers | null>(null);
  const [own, setOwn] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!needsOrganisation) return;

    let current = true;
    api.joinOffers().then(
      (found) => {
        if (current) setOffered(found);
      },
      // Without the offers the organisation fields show, as they would with none.
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [needsOrganisation]);

  const offers = offered?.offers ?? [];
  const showOffers = asksForOrganisation && offers.length > 0 && !own;
  const founding = asksForOrganisation && !showOffers;

  function change(field: Exclude<Field, 'timezone'>, value: string): void {
    setValues((previous) => {
      const next = { ...previous, [field]: value };

      if (field === 'countryCode') {
        next.phoneCountryCode = followCountry(
          { code: previous.phoneCountryCode, picked: phonePicked },
          value,
        ).code;
      }

      return next;
    });
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      // A number checked for one country says nothing about another, whether picked or followed.
      if (field === 'phoneCountryCode' || (field === 'countryCode' && !phonePicked)) {
        delete next.phoneNumber;
      }

      return next;
    });
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (answering || showOffers) return;

    await send(null);
  }

  /** Saving, or asking to join `askToJoin` instead of founding: the same checks either way. */
  async function send(askToJoin: string | null): Promise<void> {
    const founds = founding && askToJoin == null;
    // Checked before sending, every field at once, and the first one that needs attention is focused.
    const checked: Errors = {};
    if (values.name.trim() === '') checked.name = t('completeProfile.nameBlank');
    if (founds && values.organisationName.trim() === '') {
      checked.organisationName = t(
        stillOpen > 0
          ? 'completeProfile.organisationOrInvitation'
          : 'completeProfile.organisationBlank',
      );
    }
    if (founds && values.countryCode === '') {
      checked.countryCode = t('forms.countryBlank');
    }
    // Optional: an empty field is no phone, so only a typed number is checked.
    if (values.phoneNumber.trim() !== '') {
      const problem = phoneProblemMessage(
        phoneLengthProblem(values.phoneNumber, values.phoneCountryCode),
        values.phoneCountryCode,
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
            : checked.countryCode != null
              ? countryInput
              : phoneInput;
      first.current?.focus();
      return;
    }

    setSaving(true);
    setFailed(false);
    setUnavailable(false);

    try {
      const saved = await api.completeProfile({
        name: values.name.trim(),
        ...(askToJoin != null ? { askToJoin } : {}),
        ...(founds
          ? {
              organisationName: values.organisationName.trim(),
              countryCode: values.countryCode,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : {}),
        phoneCountryCode: values.phoneCountryCode,
        phoneNumber: values.phoneNumber.trim(),
      });

      if (firstJoined != null) rememberOrganisation(firstJoined);
      await adoptAccount(saved.account);
      onSaved(saved.verificationNeeded, askToJoin != null);
    } catch (error) {
      setSaving(false);

      if (error instanceof ApiError && error.is('join_offer_unavailable')) {
        // Taken off the list since the screen opened: what is offered now, and the fields if nothing is.
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

      setFailed(true);
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={(event) => void save(event)}>
      {failed && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('completeProfile.failedTitle')}</p>
            <p>{t('completeProfile.failedBody')}</p>
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="name">{t('completeProfile.name')}</label>
        <input
          ref={nameInput}
          className={errors.name == null ? 'input' : 'input input-wrong'}
          id="name"
          type="text"
          autoComplete="name"
          autoCorrect="off"
          spellCheck={false}
          value={values.name}
          disabled={saving}
          aria-invalid={errors.name != null}
          aria-describedby={errors.name == null ? undefined : 'name-error'}
          onChange={(event) => change('name', event.target.value)}
        />
        {errors.name != null && <FieldError id="name-error" message={errors.name} />}
      </div>

      {waiting.invitations.length > 0 && (
        <section className="profile-invitations" aria-labelledby="profile-invitations-heading">
          <div className="profile-invitations-head">
            <p id="profile-invitations-heading" className="profile-invitations-heading">
              {t('invitations.heading')}
            </p>
            <p className="profile-invitations-intro">
              {firstJoined != null
                ? t('completeProfile.invitationsJoined')
                : stillOpen === 0
                  ? t('completeProfile.invitationsNone')
                  : t('completeProfile.invitationsWaiting', { count: stillOpen })}
            </p>
          </div>
          <InvitationRows
            waiting={waiting}
            place="profile"
            after={{
              note: (id) => {
                const outcome = waiting.outcomes[id];
                const first =
                  outcome?.kind === 'accepted' && outcome.organisationId === firstJoined;

                return t(
                  first ? 'completeProfile.joinedGoesThere' : 'completeProfile.joinedSwitchLater',
                );
              },
            }}
          />
        </section>
      )}

      {asksForOrganisation && stillOpen > 0 && (
        <p className="or-rule">{t('completeProfile.orStartOwn')}</p>
      )}

      {unavailable && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{t('domainJoining.unavailable')}</p>
        </div>
      )}

      {showOffers && (
        <div className="join-offers" role="group" aria-labelledby="join-offers-heading">
          <div className="join-offers-intro">
            <p className="join-offers-heading" id="join-offers-heading">
              {t('domainJoining.heading')}
            </p>
            <p className="field-help">
              {t('domainJoining.intro', { domain: offered?.domain ?? '' })}
            </p>
          </div>
          {offers.map((offer) => (
            <div className="join-offer" key={offer.id}>
              <div className="join-offer-text">
                <p className="join-offer-title">
                  {t('domainJoining.usesSoirely', { organisation: offer.name })}
                </p>
                <p className="field-help">{t('domainJoining.approvesFirst')}</p>
              </div>
              <button
                className={offers.length === 1 ? 'button button-primary' : 'button'}
                type="button"
                disabled={saving}
                aria-label={t('domainJoining.askLabel', { organisation: offer.name })}
                onClick={() => void send(offer.id)}
              >
                {t('domainJoining.ask')}
              </button>
            </div>
          ))}
          <button className="button" type="button" disabled={saving} onClick={() => setOwn(true)}>
            {t('domainJoining.startOwn')}
          </button>
        </div>
      )}

      {asksForOrganisation && offers.length > 0 && own && (
        <button
          className="link-button join-offers-back"
          type="button"
          onClick={() => setOwn(false)}
        >
          {t('domainJoining.askInstead', { domain: offered?.domain ?? '' })}
        </button>
      )}

      {founding && (
        <>
          <div className="field">
            <label htmlFor="organisation">{t('completeProfile.organisation')}</label>
            <input
              ref={organisationInput}
              className={errors.organisationName == null ? 'input' : 'input input-wrong'}
              id="organisation"
              type="text"
              autoComplete="organization"
              autoCorrect="off"
              spellCheck={false}
              maxLength={100}
              value={values.organisationName}
              disabled={saving}
              aria-invalid={errors.organisationName != null}
              aria-describedby={
                errors.organisationName == null
                  ? 'organisation-help'
                  : 'organisation-error organisation-help'
              }
              onChange={(event) => change('organisationName', event.target.value)}
            />
            {errors.organisationName != null && (
              <FieldError id="organisation-error" message={errors.organisationName} />
            )}
            <p className="field-help" id="organisation-help">
              {t('completeProfile.organisationHelp')}
            </p>
          </div>

          <div className="field">
            <label htmlFor="country">{t('completeProfile.country')}</label>
            <select
              className={errors.countryCode == null ? 'input' : 'input input-wrong'}
              id="country"
              ref={countryInput}
              value={values.countryCode}
              disabled={saving}
              aria-invalid={errors.countryCode != null}
              aria-describedby={errors.countryCode == null ? undefined : 'country-error'}
              onChange={(event) => change('countryCode', event.target.value)}
            >
              <option value="" disabled hidden />
              {countries.map(({ code, name: countryName }) => (
                <option key={code} value={code}>
                  {countryName}
                </option>
              ))}
            </select>
            {errors.countryCode != null && (
              <FieldError id="country-error" message={errors.countryCode} />
            )}
          </div>

          {errors.timezone != null && <FieldError id="timezone-error" message={errors.timezone} />}
        </>
      )}

      <PhoneEntry
        label={
          <span className="label-row">
            {t('verifyPhone.numberLabel')}
            <span className="pill-quiet">{t('completeProfile.optional')}</span>
          </span>
        }
        country={values.phoneCountryCode}
        number={values.phoneNumber}
        error={errors.phoneNumber ?? errors.phoneCountryCode ?? null}
        disabled={saving}
        help={t('completeProfile.mobileHelp')}
        inputRef={phoneInput}
        onCountry={(code) => {
          setPhonePicked(pickPhoneCountry(code).picked);
          change('phoneCountryCode', code);
        }}
        onNumber={(typed) => change('phoneNumber', typed)}
      />

      {!showOffers && (
        <button
          className="button button-primary"
          type="submit"
          aria-busy={saving}
          disabled={answering}
        >
          {saving ? t('completeProfile.saving') : t('completeProfile.save')}
        </button>
      )}
    </form>
  );
}
