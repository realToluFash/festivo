import { ApiError, type Membership } from '@soirely/api-client';
import { type NewOrganisationField, countryChoices, deviceCountry } from '@soirely/domain';
import { type FormEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../api.ts';
import { FieldError } from '../../components/FieldError.tsx';
import { InvitationRows } from '../../components/InvitationRows.tsx';
import { useFocusAfterSave } from '../../formChecks.ts';
import { currentLocale } from '../../i18n/index.ts';
import type { WaitingInvitations } from '../../invitations.ts';
import { joinOrganisation, useSession } from '../../session.ts';

/** Where an account in no organisation lands, with any invitation waiting for it and a way to start its own. Its own account pages still work from here. */
export function NoOrganisation({
  waiting,
  onOpen,
  onStarted,
}: {
  waiting: WaitingInvitations;
  onOpen: (organisationId: string) => void;
  onStarted: (started: Membership) => void;
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
          <InvitationRows waiting={waiting} place="page" after={{ open: onOpen }} />
        </div>
      ) : (
        <p>{t('noOrganisation.wayOn', { email: session.email })}</p>
      )}
      <StartOrganisation email={session.email} onStarted={onStarted} />
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

const NAME_MOST = 100;

function StartOrganisation({
  email,
  onStarted,
}: {
  email: string;
  onStarted: (started: Membership) => void;
}) {
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
  const focusAfterSave = useFocusAfterSave<NewOrganisationField>(saving, (field) =>
    (field === 'name' ? nameInput : countryInput).current?.focus(),
  );

  function change(field: NewOrganisationField, value: string): void {
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
    const name = values.name.trim();
    const length = Array.from(name).length;
    if (name === '') checked.name = t('orgGeneral.nameBlank');
    else if (length > NAME_MOST)
      checked.name = t('noOrganisation.nameTooLong', { count: length, most: NAME_MOST });
    if (values.countryCode === '') checked.countryCode = t('forms.countryBlank');

    if (Object.keys(checked).length > 0) {
      setErrors(checked);
      (checked.name != null ? nameInput : countryInput).current?.focus();
      return;
    }

    setSaving(true);
    setFailed(false);

    try {
      const membership = await api.createOrganisation({
        name: values.name.trim(),
        countryCode: values.countryCode,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      joinOrganisation(membership);
      onStarted(membership);
    } catch (error) {
      focusAfterSave('name');
      setSaving(false);

      if (error instanceof ApiError && error.is('validation_failed')) {
        const fields = error.fieldErrors();

        // A refusal naming only a field this form lacks, such as the derived contact address.
        if (fields.name != null || fields.countryCode != null) {
          setErrors({ name: fields.name, countryCode: fields.countryCode } as Errors);
          if (fields.name == null) focusAfterSave('countryCode');
          return;
        }
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
          {t('noOrganisation.nameHelp')}
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

      <div className="notice notice-quiet">
        <p>{t('noOrganisation.derived', { email })}</p>
      </div>

      <button className="button button-primary" type="submit" aria-busy={saving}>
        {saving ? t('noOrganisation.starting') : t('noOrganisation.start')}
      </button>
    </form>
  );
}
