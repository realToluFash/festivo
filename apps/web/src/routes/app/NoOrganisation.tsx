import { ApiError } from '@soirely/api-client';
import { countryChoices, deviceCountry } from '@soirely/domain';
import { type FormEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../api.ts';
import { FieldError } from '../../components/FieldError.tsx';
import { InvitationRows } from '../../components/InvitationRows.tsx';
import { currentLocale } from '../../i18n/index.ts';
import type { WaitingInvitations } from '../../invitations.ts';
import { joinOrganisation, useSession } from '../../session.ts';

/** Where an account in no organisation lands, with any invitation waiting for it and a way to start its own. Its own account pages still work from here. */
export function NoOrganisation({
  waiting,
  onOpen,
}: {
  waiting: WaitingInvitations;
  onOpen: (organisationId: string) => void;
}) {
  const { t } = useTranslation();
  const session = useSession();

  return (
    <section className="card no-organisation" aria-labelledby="no-organisation-title">
      <h1 id="no-organisation-title">{t('noOrganisation.title')}</h1>
      <p>{t('noOrganisation.body')}</p>
      {waiting.invitations.length > 0 ? (
        <div className="no-organisation-invitations">
          <p className="no-organisation-heading">{t('invitations.heading')}</p>
          <InvitationRows waiting={waiting} place="page" onOpen={onOpen} />
        </div>
      ) : (
        <p>{t('noOrganisation.wayOn', { email: session.email })}</p>
      )}
      <StartOrganisation onStarted={onOpen} />
      <div className="auth-footnote">
        <span>{t('noOrganisation.signedInAs', { email: session.email })}</span>
        <Link className="link-button" to="/app/account/security">
          {t('noOrganisation.account')}
        </Link>
      </div>
    </section>
  );
}

type Field = 'name' | 'countryCode' | 'timezone';
type Errors = Partial<Record<Field, string>>;

function StartOrganisation({ onStarted }: { onStarted: (organisationId: string) => void }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const countries = useMemo(() => countryChoices(locale), [locale]);
  const [values, setValues] = useState(() => ({
    name: '',
    countryCode: deviceCountry(navigator.languages) ?? '',
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const countryInput = useRef<HTMLSelectElement>(null);

  function change(field: 'name' | 'countryCode', value: string): void {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  async function start(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const checked: Errors = {};
    if (values.name.trim() === '') checked.name = t('completeProfile.organisationBlank');
    if (values.countryCode === '') checked.countryCode = t('forms.countryBlank');

    if (Object.keys(checked).length > 0) {
      setErrors(checked);
      (checked.name != null ? nameInput : countryInput).current?.focus();
      return;
    }

    setSaving(true);
    setFailed(false);

    try {
      const membership = await api.foundOrganisation({
        name: values.name.trim(),
        countryCode: values.countryCode,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      joinOrganisation(membership);
      onStarted(membership.id);
    } catch (error) {
      setSaving(false);

      if (error instanceof ApiError && error.is('validation_failed')) {
        setErrors(error.fieldErrors() as Errors);
        return;
      }

      setFailed(true);
    }
  }

  return (
    <form
      className="auth-form no-organisation-start"
      noValidate
      aria-labelledby="start-organisation-title"
      onSubmit={(event) => void start(event)}
    >
      <p className="no-organisation-heading" id="start-organisation-title">
        {t('noOrganisation.startTitle')}
      </p>
      <p>{t('noOrganisation.startBody')}</p>

      {failed && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p className="notice-title">{t('noOrganisation.startFailed')}</p>
        </div>
      )}

      <div className="field">
        <label htmlFor="start-organisation-name">{t('completeProfile.organisation')}</label>
        <input
          ref={nameInput}
          className={errors.name == null ? 'input' : 'input input-wrong'}
          id="start-organisation-name"
          type="text"
          autoComplete="organization"
          autoCorrect="off"
          spellCheck={false}
          maxLength={100}
          value={values.name}
          disabled={saving}
          aria-invalid={errors.name != null}
          aria-describedby={
            errors.name == null
              ? 'start-organisation-help'
              : 'start-organisation-error start-organisation-help'
          }
          onChange={(event) => change('name', event.target.value)}
        />
        {errors.name != null && <FieldError id="start-organisation-error" message={errors.name} />}
        <p className="field-help" id="start-organisation-help">
          {t('completeProfile.organisationHelp')}
        </p>
      </div>

      <div className="field">
        <label htmlFor="start-organisation-country">{t('completeProfile.country')}</label>
        <select
          ref={countryInput}
          className={errors.countryCode == null ? 'input' : 'input input-wrong'}
          id="start-organisation-country"
          value={values.countryCode}
          disabled={saving}
          aria-invalid={errors.countryCode != null}
          aria-describedby={
            errors.countryCode == null ? undefined : 'start-organisation-country-error'
          }
          onChange={(event) => change('countryCode', event.target.value)}
        >
          <option value="" disabled hidden />
          {countries.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        {errors.countryCode != null && (
          <FieldError id="start-organisation-country-error" message={errors.countryCode} />
        )}
      </div>

      {errors.timezone != null && (
        <FieldError id="start-organisation-timezone-error" message={errors.timezone} />
      )}

      <button className="button button-primary" type="submit" aria-busy={saving}>
        {saving ? t('noOrganisation.starting') : t('noOrganisation.start')}
      </button>
    </form>
  );
}
