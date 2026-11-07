import { ApiError, type Membership } from '@soirely/api-client';
import {
  type NewOrganisationField,
  countryChoices,
  deviceCountry,
  formatTimeOfDay,
  lockLiftsAt,
  newOrganisationProblem,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { useFormChecks } from '../formChecks.ts';
import { currentLocale, dateLocale } from '../i18n/index.ts';
import { focusWhereSent, offField } from '../offField.ts';
import { FieldError } from './FieldError.tsx';
import { useDialogKeys } from '../dialogFocus.ts';

const FIELDS: readonly NewOrganisationField[] = ['name', 'countryCode'];

/** `OrgSwitcher-Desktop` states `create` to `create_limited` (sc-390): the new organisation, made by the caller as its Owner. */
export function CreateOrganisation({
  email,
  onCreated,
  onCancel,
}: {
  email: string;
  onCreated: (created: Membership) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const countries = useMemo(() => countryChoices(locale), [locale]);
  const [values, setValues] = useState<Record<NewOrganisationField, string>>(() => ({
    name: '',
    // A browser exposes no Region setting, so its languages decide, and nothing named means blank.
    countryCode: deviceCountry(navigator.languages) ?? '',
  }));
  const [refused, setRefused] = useState<Partial<Record<NewOrganisationField, string | undefined>>>(
    {},
  );
  const [limitedUntil, setLimitedUntil] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const countryInput = useRef<HTMLSelectElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const focusField = (field: NewOrganisationField): void =>
    (field === 'name' ? nameInput : countryInput).current?.focus();
  const checks = useFormChecks<NewOrganisationField>(
    FIELDS,
    (field, value) => problemMessage(field, value, t),
    focusField,
  );
  const errors = { ...refused, ...checks.errors };

  useEffect(() => {
    const opener = document.activeElement;

    nameInput.current?.focus();

    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  useDialogKeys(dialog, onCancel, saving);

  function change(field: NewOrganisationField, value: string): void {
    setValues((previous) => ({ ...previous, [field]: value }));
    setRefused((previous) => ({ ...previous, [field]: undefined }));
    checks.edited(field, value);
  }

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving) return;
    setRefused({});

    if (!checks.passes(values)) return;

    setSaving(true);
    // A click's button turns off under it (sc-8898); Enter leaves focus in the field.
    if (document.activeElement !== nameInput.current) dialog.current?.focus();
    const land = focusWhereSent();
    setFailed(false);
    setLimitedUntil(null);

    try {
      onCreated(
        await api.createOrganisation({
          name: values.name.trim(),
          countryCode: values.countryCode,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      );
    } catch (error) {
      flushSync(() => setSaving(false));

      if (error instanceof ApiError && error.is('too_many_attempts')) {
        land('create-organisation-name');
        const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));
        setLimitedUntil(liftsAt == null ? '' : formatTimeOfDay(liftsAt, dateLocale()));
        return;
      }

      if (error instanceof ApiError && error.is('validation_failed')) {
        const fields = error.fieldErrors();
        land(
          fields.name == null && fields.countryCode != null
            ? 'create-organisation-country'
            : 'create-organisation-name',
        );

        // A refusal naming only a field this form lacks, such as the derived contact address.
        if (fields.name == null && fields.countryCode == null) {
          setFailed(true);
          return;
        }

        setRefused({ name: fields.name, countryCode: fields.countryCode });
        return;
      }

      land('create-organisation-name');
      setFailed(true);
    }
  }

  return (
    <>
      <button
        type="button"
        className="dialog-scrim"
        tabIndex={-1}
        aria-label={t('createOrganisation.cancel')}
        disabled={saving}
        onClick={onCancel}
      />
      <div
        ref={dialog}
        className="dialog"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-organisation-title"
      >
        <div className="dialog-heading">
          <h2 id="create-organisation-title">{t('createOrganisation.title')}</h2>
          <p>{t('createOrganisation.intro')}</p>
        </div>

        {limitedUntil != null && (
          <div className="notice notice-attention" role="alert">
            <span className="mark mark-attention" aria-hidden="true">
              !
            </span>
            <div className="notice-body">
              <p className="notice-title">{t('createOrganisation.limitedTitle')}</p>
              {limitedUntil !== '' && (
                <p>{t('createOrganisation.limitedBody', { time: limitedUntil })}</p>
              )}
            </div>
          </div>
        )}

        {failed && (
          <div className="notice notice-broken" role="alert">
            <span className="mark mark-broken" aria-hidden="true">
              ✕
            </span>
            <div className="notice-body">
              <p>{t('createOrganisation.failed')}</p>
            </div>
          </div>
        )}

        <form className="dialog-form" noValidate onSubmit={(event) => void create(event)}>
          <div className="field">
            <label htmlFor="create-organisation-name">{t('createOrganisation.name')}</label>
            <input
              ref={nameInput}
              className={errors.name == null ? 'input' : 'input input-wrong'}
              id="create-organisation-name"
              type="text"
              autoComplete="organization"
              autoCorrect="off"
              spellCheck={false}
              value={values.name}
              {...offField(saving)}
              aria-invalid={errors.name != null}
              aria-describedby={
                errors.name == null
                  ? 'create-organisation-name-help'
                  : 'create-organisation-name-error create-organisation-name-help'
              }
              onChange={(event) => change('name', event.target.value)}
              onBlur={(event) => checks.left('name', event.target.value)}
            />
            {errors.name != null && (
              <FieldError id="create-organisation-name-error" message={errors.name} />
            )}
            <p className="field-help" id="create-organisation-name-help">
              {t('createOrganisation.nameHelp')}
            </p>
          </div>

          <div className="field">
            <label htmlFor="create-organisation-country">{t('createOrganisation.country')}</label>
            <select
              ref={countryInput}
              className={errors.countryCode == null ? 'input' : 'input input-wrong'}
              id="create-organisation-country"
              value={values.countryCode}
              disabled={saving}
              aria-invalid={errors.countryCode != null}
              aria-describedby={
                errors.countryCode == null ? undefined : 'create-organisation-country-error'
              }
              onChange={(event) => change('countryCode', event.target.value)}
              onBlur={(event) => checks.left('countryCode', event.target.value)}
            >
              <option value="" disabled hidden />
              {countries.map(({ code, name }) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            {errors.countryCode != null && (
              <FieldError id="create-organisation-country-error" message={errors.countryCode} />
            )}
          </div>

          <p className="dialog-note">{t('createOrganisation.defaults', { email })}</p>

          <div className="dialog-actions">
            <button className="button" type="button" onClick={onCancel} disabled={saving}>
              {t('createOrganisation.cancel')}
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? t('createOrganisation.creating') : t('createOrganisation.create')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function problemMessage(field: NewOrganisationField, value: string, t: TFunction): string | null {
  const problem = newOrganisationProblem(field, value);

  if (problem == null) return null;
  if (problem.kind === 'nameLong')
    return t('createOrganisation.nameLong', { length: problem.length });

  return problem.kind === 'nameBlank' ? t('orgGeneral.nameBlank') : t('forms.countryBlank');
}
