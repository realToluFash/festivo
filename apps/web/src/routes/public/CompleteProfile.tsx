import { ApiError } from '@soirely/api-client';
import { countryChoices, deviceCountry, phoneLengthProblem } from '@soirely/domain';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { FieldError } from '../../components/FieldError.tsx';
import { LinkedNotice } from '../../components/LinkedNotice.tsx';
import { AuthPage } from '../../components/AuthPage.tsx';
import { Pending } from '../../components/Pending.tsx';
import { PhoneEntry } from '../../components/PhoneEntry.tsx';
import { Unreachable } from '../../components/Unreachable.tsx';
import { currentLocale } from '../../i18n/index.ts';
import { phoneProblemMessage } from '../../phoneProblem.ts';
import {
  adoptAccount,
  forgetSession,
  landingFor,
  restoreSession,
  useSessionState,
} from '../../session.ts';

type Field =
  'name' | 'organisationName' | 'countryCode' | 'timezone' | 'phoneCountryCode' | 'phoneNumber';
type Errors = Partial<Record<Field, string>>;

/** The second gate. Reached when the API says `profile_incomplete`, or straight after verifying. */
export function CompleteProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useSessionState();

  useEffect(() => {
    void restoreSession();
  }, []);

  if (state.status === 'signedOut') return <Navigate to="/sign-in" replace />;
  if (state.status === 'unreachable') return <Unreachable />;
  if (state.status !== 'signedIn') return <Pending />;

  // Only the gate it is behind: an unverified account verifies first, a complete one is let in.
  const landing = landingFor(state.session.awaiting);
  const byGoogle = state.session.providers.includes('google');
  if (landing !== '/complete-profile') return <Navigate to={landing} replace />;

  async function signOut(): Promise<void> {
    await api.signOut();
    forgetSession();
    navigate('/sign-in');
  }

  return (
    <AuthPage>
      <ol className="steps" aria-label={t('verifyEmail.stepsLabel')}>
        <li className="step step-done">
          <span className="step-mark" aria-hidden="true">
            ✓
          </span>
          {byGoogle
            ? t('verifyEmail.step1Google', { provider: 'Google' })
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

      <div className="auth-heading">
        <h1>{t('completeProfile.title')}</h1>
        <p>{t('completeProfile.intro')}</p>
      </div>

      {byGoogle && (
        <div className="notice notice-quiet" role="status">
          <span className="mark mark-info" aria-hidden="true">
            i
          </span>
          <p>
            {t('completeProfile.providerConfirmed', {
              provider: 'Google',
              email: state.session.email,
            })}
          </p>
        </div>
      )}

      <Details
        name={state.session.name}
        needsOrganisation={state.session.needsOrganisation}
        onSaved={(verificationNeeded) =>
          navigate(verificationNeeded ? '/verify-phone?from=onboarding' : '/app', {
            replace: true,
          })
        }
      />

      <div className="auth-footnote">
        <span>{t('completeProfile.signedInAs', { email: state.session.email })}</span>
        <button className="link-button" type="button" onClick={() => void signOut()}>
          {t('completeProfile.signOut')}
        </button>
      </div>
    </AuthPage>
  );
}

function Details({
  name,
  needsOrganisation,
  onSaved,
}: {
  name: string;
  needsOrganisation: boolean;
  onSaved: (verificationNeeded: boolean) => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const countries = useMemo(() => countryChoices(locale), [locale]);
  const [values, setValues] = useState(() => {
    const country = deviceCountry(navigator.languages) ?? countries[0]?.code ?? '';

    return {
      name,
      organisationName: '',
      countryCode: country,
      phoneCountryCode: country,
      phoneNumber: '',
    };
  });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const organisationInput = useRef<HTMLInputElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);

  function change(field: Exclude<Field, 'timezone'>, value: string): void {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      // A number checked for one country says nothing about another.
      if (field === 'phoneCountryCode') delete next.phoneNumber;

      return next;
    });
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    // Checked before sending, every field at once, and the first one that needs attention is focused.
    const checked: Errors = {};
    if (values.name.trim() === '') checked.name = t('completeProfile.nameBlank');
    if (needsOrganisation && values.organisationName.trim() === '') {
      checked.organisationName = t('completeProfile.organisationBlank');
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
            : phoneInput;
      first.current?.focus();
      return;
    }

    setSaving(true);
    setFailed(false);

    try {
      const saved = await api.completeProfile({
        name: values.name.trim(),
        ...(needsOrganisation
          ? {
              organisationName: values.organisationName.trim(),
              countryCode: values.countryCode,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : {}),
        phoneCountryCode: values.phoneCountryCode,
        phoneNumber: values.phoneNumber.trim(),
      });

      await adoptAccount(saved.account);
      onSaved(saved.verificationNeeded);
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

      {needsOrganisation && (
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
              value={values.countryCode}
              disabled={saving}
              aria-invalid={errors.countryCode != null}
              aria-describedby={errors.countryCode == null ? undefined : 'country-error'}
              onChange={(event) => change('countryCode', event.target.value)}
            >
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
        onCountry={(code) => change('phoneCountryCode', code)}
        onNumber={(typed) => change('phoneNumber', typed)}
      />

      <button className="button button-primary" type="submit" aria-busy={saving}>
        {saving ? t('completeProfile.saving') : t('completeProfile.save')}
      </button>
    </form>
  );
}
