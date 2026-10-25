import { ApiError, type Membership } from '@soirely/api-client';
import {
  ORGANISATION_FIELDS,
  ORGANISATION_NAME_MAXIMUM,
  type OrganisationField,
  countryChoices,
  heldCurrencyLabel,
  languageChoices,
  organisationChanges,
  organisationProblem,
  roleName,
  timezoneLabel,
} from '@soirely/domain';
import { type FormEvent, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { CompanyDomainsCard } from './CompanyDomainsCard.tsx';
import { OwnershipCard } from './OwnershipCard.tsx';
import { RecoveryRequestsCard } from './RecoveryRequestsCard.tsx';
import { RequestLinkCard } from './RequestLinkCard.tsx';
import { SettingsSections } from '../../../components/SettingsSections.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { focusWhereSent, offField } from '../../../offField.ts';
import { can, replaceOrganisation, useSession } from '../../../session.ts';
import { useStepFocus } from '../../../stepFocus.ts';
import { currencyChoices, timeZoneChoices } from '../../../zoneAndCurrencyChoices.ts';

type Field = OrganisationField;
type Errors = Partial<Record<Field, string>>;

type Status =
  | { kind: 'editing' }
  | { kind: 'saving' }
  | { kind: 'saved'; language: string | null }
  | { kind: 'failed' };

export function General() {
  const { t } = useTranslation();
  const session = useSession();
  const organisation = session.organisation;
  const [refusedIn, setRefusedIn] = useState<string | null>(null);
  const [refusal, arriveAtRefusal] = useStepFocus<HTMLDivElement>();

  if (organisation == null) return null;

  const refused = refusedIn === organisation.id;

  return (
    <div className="settings">
      <SettingsSections />
      <div className="settings-heading">
        <h1>{t('orgGeneral.title')}</h1>
        <p>{t('orgGeneral.intro')}</p>
      </div>

      <RecoveryRequestsCard />

      {refused && (
        <div className="notice notice-broken" ref={refusal} tabIndex={-1}>
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{t('orgGeneral.refused')}</p>
        </div>
      )}

      <section className="card settings-card" aria-labelledby="organisation-title">
        <h2 id="organisation-title">{t('orgGeneral.section')}</h2>
        {can(session, 'organisation.manage') && !refused ? (
          <Editable
            key={organisation.id}
            organisation={organisation}
            onRefused={() => {
              setRefusedIn(organisation.id);
              arriveAtRefusal();
            }}
          />
        ) : (
          <ReadOnly organisation={organisation} />
        )}
      </section>

      {can(session, 'members.manage') && (
        <CompanyDomainsCard key={organisation.id} organisation={organisation} />
      )}

      {can(session, 'members.manage') && (
        <RequestLinkCard key={organisation.id} organisation={organisation} />
      )}

      <OwnershipCard key={organisation.id} organisation={organisation} />
    </div>
  );
}

function Editable({
  organisation,
  onRefused,
}: {
  organisation: Membership;
  onRefused: () => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [values, setValues] = useState({
    name: organisation.name,
    countryCode: organisation.countryCode,
    contactAddress: organisation.contactAddress,
    currency: organisation.currency,
    timezone: organisation.timezone,
    locale: organisation.locale,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>({ kind: 'editing' });

  const countries = useMemo(() => countryChoices(locale), [locale]);
  const currencies = useMemo(
    () => currencyChoices(organisation.currency, values.currency, locale, t),
    [organisation.currency, values.currency, locale, t],
  );
  const timezones = useMemo(() => timeZoneChoices(organisation.timezone), [organisation.timezone]);

  const busy = status.kind === 'saving';

  function change(field: Field, value: string): void {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    if (status.kind === 'saved') setStatus({ kind: 'editing' });
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;

    const checked = checkBeforeSending(values, t);

    if (Object.keys(checked).length > 0) {
      setErrors(checked);
      focusFirst(checked, (id) => document.getElementById(id)?.focus());
      return;
    }

    setStatus({ kind: 'saving' });
    const land = focusWhereSent();

    try {
      const saved = await api.updateOrganisation(
        organisation.id,
        organisationChanges(organisation, values),
      );

      replaceOrganisation({ ...organisation, ...saved });
      setStatus({
        kind: 'saved',
        language: saved.locale === organisation.locale ? null : saved.locale,
      });
    } catch (error) {
      if (error instanceof ApiError && error.is('permission_required')) {
        onRefused();
        void rereadOrganisation(organisation.id);
        return;
      }

      if (error instanceof ApiError && error.is('validation_failed')) {
        const refused = error.fieldErrors() as Errors;
        setErrors(refused);
        flushSync(() => setStatus({ kind: 'editing' }));
        focusFirst(refused, land);
        return;
      }

      setStatus({ kind: 'failed' });
    }
  }

  return (
    <form className="settings-form" noValidate onSubmit={(event) => void save(event)}>
      {status.kind === 'saved' && (
        <div className="notice notice-done" role="status">
          <span className="mark mark-done" aria-hidden="true">
            ✓
          </span>
          <p>
            {status.language == null
              ? t('orgGeneral.saved', { name: organisation.name })
              : t('orgGeneral.savedLanguage', {
                  language: languageNameInSentence(t, status.language),
                })}
          </p>
        </div>
      )}

      {status.kind === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{t('orgGeneral.failed')}</p>
        </div>
      )}

      <div className="settings-fields">
        <Text
          field="name"
          label={t('orgGeneral.name')}
          value={values.name}
          error={errors.name}
          busy={busy}
          autoComplete="organization"
          maxLength={ORGANISATION_NAME_MAXIMUM}
          onChange={change}
        />
        <Choice
          field="countryCode"
          label={t('orgGeneral.country')}
          value={values.countryCode}
          error={errors.countryCode}
          busy={busy}
          options={countries.map(({ code, name }) => ({ value: code, label: name }))}
          onChange={change}
        />
        <Text
          field="contactAddress"
          label={t('orgGeneral.contact')}
          value={values.contactAddress}
          error={errors.contactAddress}
          busy={busy}
          type="email"
          autoComplete="email"
          onChange={change}
        />
        <Choice
          field="currency"
          label={t('orgGeneral.currency')}
          value={values.currency}
          error={errors.currency}
          busy={busy}
          options={currencies}
          onChange={change}
        />
        <Choice
          field="timezone"
          label={t('orgGeneral.timezone')}
          value={values.timezone}
          error={errors.timezone}
          busy={busy}
          options={timezones}
          onChange={change}
        />
      </div>

      <DefaultsNote />

      <div className="settings-fields">
        <Choice
          field="locale"
          label={t('orgGeneral.language')}
          help={t('orgGeneral.languageHint')}
          value={values.locale}
          error={errors.locale}
          busy={busy}
          options={languageChoices(t).map(({ code, name }) => ({ value: code, label: name }))}
          onChange={change}
        />
      </div>

      <div>
        <button className="button button-primary" type="submit" aria-busy={busy}>
          {busy ? t('orgGeneral.saving') : t('orgGeneral.save')}
        </button>
      </div>
    </form>
  );
}

/** The controls are absent, not disabled: a control that refuses reads as broken (sc-66). */
function ReadOnly({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const country = countryChoices(locale).find(
    ({ code }) => code === organisation.countryCode,
  )?.name;

  return (
    <>
      <dl className="settings-read-only">
        <div>
          <dt>{t('orgGeneral.name')}</dt>
          <dd>{organisation.name}</dd>
        </div>
        <div>
          <dt>{t('orgGeneral.country')}</dt>
          <dd>{country ?? organisation.countryCode}</dd>
        </div>
        <div>
          <dt>{t('orgGeneral.contact')}</dt>
          <dd>{organisation.contactAddress}</dd>
        </div>
        <div>
          <dt>{t('orgGeneral.currency')}</dt>
          <dd>
            {heldCurrencyLabel(organisation.currency, locale, (code) =>
              t('orgGeneral.currencyRetired', { code }),
            )}
          </dd>
        </div>
        <div>
          <dt>{t('orgGeneral.timezone')}</dt>
          <dd>{timezoneLabel(organisation.timezone)}</dd>
        </div>
      </dl>
      <DefaultsNote />
      <dl className="settings-read-only">
        <div>
          <dt>{t('orgGeneral.language')}</dt>
          <dd data-testid="organisation-locale">{languageName(t, organisation.locale)}</dd>
        </div>
      </dl>
      <p className="muted">{t('orgGeneral.readOnly', { role: roleName(t, organisation.role) })}</p>
    </>
  );
}

/** In the reader's language alone, as a row names it. */
function languageName(t: TFunction, code: string): string {
  return t(`languageNames.${code}`, { defaultValue: code });
}

/** Mid-sentence, where es, fr and pt write a language's name in lowercase. */
function languageNameInSentence(t: TFunction, code: string): string {
  return t(`languageNamesInSentence.${code}`, { defaultValue: code });
}

/** The role may have changed under the page; the session catches up so every other screen does too. */
async function rereadOrganisation(id: string): Promise<void> {
  try {
    const fresh = (await api.organisations()).find((membership) => membership.id === id);
    if (fresh != null) replaceOrganisation(fresh);
  } catch {
    // The refusal is already on screen; a failed reread leaves the rest of the page as it was.
  }
}

function DefaultsNote() {
  const { t } = useTranslation();

  return (
    <div className="notice notice-quiet">
      <span className="mark mark-info" aria-hidden="true">
        i
      </span>
      <p>{t('orgGeneral.defaultsNote')}</p>
    </div>
  );
}

function Text({
  field,
  label,
  value,
  error,
  busy,
  type = 'text',
  autoComplete,
  maxLength,
  onChange,
}: {
  field: Field;
  label: string;
  value: string;
  error: string | undefined;
  busy: boolean;
  type?: 'text' | 'email';
  autoComplete: string;
  maxLength?: number;
  onChange: (field: Field, value: string) => void;
}) {
  const id = `organisation-${field}`;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        maxLength={maxLength}
        className={error == null ? 'input' : 'input input-wrong'}
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        autoCorrect="off"
        spellCheck={false}
        {...offField(busy)}
        aria-invalid={error != null}
        aria-describedby={error == null ? undefined : `${id}-error`}
        onChange={(event) => onChange(field, event.target.value)}
      />
      {error != null && <FieldError id={`${id}-error`} message={error} />}
    </div>
  );
}

function Choice({
  field,
  label,
  help,
  value,
  error,
  busy,
  options,
  onChange,
}: {
  field: Field;
  label: string;
  help?: string;
  value: string;
  error: string | undefined;
  busy: boolean;
  options: { value: string; label: string }[];
  onChange: (field: Field, value: string) => void;
}) {
  const id = `organisation-${field}`;
  const describedBy = [error == null ? null : `${id}-error`, help == null ? null : `${id}-help`]
    .filter((one) => one != null)
    .join(' ');

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        className={[
          'input',
          error == null ? null : 'input-wrong',
          value === '' ? 'input-unchosen' : null,
        ]
          .filter((one) => one != null)
          .join(' ')}
        id={id}
        value={value}
        disabled={busy}
        aria-invalid={error != null}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        onChange={(event) => onChange(field, event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error != null && <FieldError id={`${id}-error`} message={error} />}
      {help != null && (
        <p className="field-help" id={`${id}-help`}>
          {help}
        </p>
      )}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <div className="field-error" id={id} role="alert">
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <p>{message}</p>
    </div>
  );
}

function focusFirst(errors: Errors, focus: (id: string) => void): void {
  const first = ORGANISATION_FIELDS.find((field) => errors[field] != null);
  if (first != null) focus(`organisation-${first}`);
}

function checkBeforeSending(values: Record<Field, string>, t: (key: string) => string): Errors {
  const errors: Errors = {};

  for (const field of ORGANISATION_FIELDS) {
    const problem = organisationProblem(field, values[field]);
    if (problem != null) errors[field] = t(`orgGeneral.${problem}`);
  }

  return errors;
}
