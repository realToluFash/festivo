import { ApiError, type CompanyDomains, type Membership } from '@soirely/api-client';
import {
  ORGANISATION_FIELDS,
  type OrganisationField,
  companyDomainProblem,
  countryChoices,
  domainOf,
  languageChoices,
  normaliseDomain,
  organisationChanges,
} from '@soirely/domain';
import { type RefObject, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Picker, type PickerChoice } from '../../../components/GeneralParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { Ask, Chevron, Dialog, Field, Head, RowWords } from '../../../components/SettingsParts.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { replaceOrganisation } from '../../../session.ts';
import { currencyChoices, timeZoneChoices } from '../../../zoneAndCurrencyChoices.ts';
import {
  checkBeforeSending,
  languageNameInSentence,
  rereadOrganisation,
} from './organisationDetails.ts';

type Picked = Exclude<OrganisationField, 'name' | 'contactAddress'>;
type Errors = Partial<Record<OrganisationField, string>>;
type Refusal = 'refused' | 'refusedByRule';

const DEFAULTS: readonly Picked[] = ['currency', 'timezone'];

const SEARCH: Record<Picked, string> = {
  countryCode: 'generalDesk.searchCountryCode',
  currency: 'generalDesk.searchCurrency',
  timezone: 'generalDesk.searchTimezone',
  locale: 'generalDesk.searchLocale',
};

const LABEL: Record<Picked, string> = {
  countryCode: 'orgGeneral.country',
  currency: 'orgGeneral.currency',
  timezone: 'orgGeneral.timezone',
  locale: 'orgGeneral.language',
};

/** The details on a dialog of their own; a field's list opens over it, in the same 540, and comes back on a pick. */
export function DetailsDialog({
  organisation,
  onClose,
  onSaved,
}: {
  organisation: Membership;
  onClose: () => void;
  onSaved: (line: string) => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [saved] = useState(() => ({
    name: organisation.name,
    countryCode: organisation.countryCode,
    contactAddress: organisation.contactAddress,
    currency: organisation.currency,
    timezone: organisation.timezone,
    locale: organisation.locale,
  }));
  const [values, setValues] = useState(saved);
  const [errors, setErrors] = useState<Errors>({});
  const [picking, setPicking] = useState<Picked | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [asking, setAsking] = useState(false);
  const inputs = useRef<Partial<Record<OrganisationField, HTMLElement | null>>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const changes = Object.keys(organisationChanges(saved, values)).length;

  const choices = useMemo<Record<Picked, PickerChoice[]>>(
    () => ({
      countryCode: countryChoices(locale),
      currency: currencyChoices(saved.currency, values.currency, locale, t)
        .filter((one) => one.value !== '')
        .map(({ value, label }) => ({ code: value, name: label })),
      timezone: timeZoneChoices(saved.timezone).map(({ value, label }) => ({
        code: value,
        name: label,
      })),
      locale: languageChoices(t),
    }),
    [locale, saved.currency, saved.timezone, values.currency, t],
  );

  function focusFirst(found: Errors): void {
    const first = ORGANISATION_FIELDS.find((field) => found[field] != null);
    if (first === 'name') nameRef.current?.focus();
    else if (first === 'contactAddress') contactRef.current?.focus();
    else if (first != null) inputs.current[first]?.focus();
  }

  function typed(field: 'name' | 'contactAddress', value: string): void {
    setValues((now) => ({ ...now, [field]: value }));
    setErrors((now) => ({ ...now, [field]: undefined }));
  }

  async function save(): Promise<void> {
    if (saving || refused != null || changes === 0) return;

    const checked = checkBeforeSending(values, t);
    if (Object.keys(checked).length > 0) {
      setErrors(checked);
      focusFirst(checked);
      return;
    }

    setSaving(true);
    setFailed(false);

    try {
      const answer = await api.updateOrganisation(
        organisation.id,
        organisationChanges(saved, values),
      );

      replaceOrganisation({ ...organisation, ...answer });
      onSaved(
        answer.locale === saved.locale
          ? t('orgGeneral.saved', { name: answer.name })
          : t('orgGeneral.savedLanguage', {
              language: languageNameInSentence(t, answer.locale),
            }),
      );
    } catch (error) {
      setSaving(false);
      const byRule =
        error instanceof ApiError &&
        (error.is('oauth_only_unlinked') || error.is('organisation_two_factor_required'));

      if (byRule || (error instanceof ApiError && error.is('permission_required'))) {
        flushSync(() => setRefused(byRule ? 'refusedByRule' : 'refused'));
        alertRef.current?.focus();
        void rereadOrganisation(organisation.id).catch(() => {});
        return;
      }

      if (error instanceof ApiError && error.is('validation_failed')) {
        const found = error.fieldErrors() as Errors;
        flushSync(() => setErrors(found));
        focusFirst(found);
        return;
      }

      setFailed(true);
    }
  }

  function back(field: Picked, code?: string): void {
    setPicking(null);
    if (code != null) {
      setValues((now) => ({ ...now, [field]: code }));
      setErrors((now) => ({ ...now, [field]: undefined }));
    }
    focusSoon(() => inputs.current[field]);
  }

  const pickerRow = (field: Picked) => {
    const chosen =
      choices[field].find((choice) => choice.code === values[field])?.name ??
      (field === 'currency' && values.currency === ''
        ? t('orgGeneral.currencyPlaceholder')
        : values[field]);
    const error = errors[field];

    return (
      <>
        <button
          ref={(row) => {
            inputs.current[field] = row;
          }}
          type="button"
          className="desk-row is-plain"
          aria-label={`${t(LABEL[field])}, ${chosen}`}
          onClick={() => {
            if (!saving) setPicking(field);
          }}
        >
          <RowWords title={chosen} lines={[t(LABEL[field])]} />
          <Chevron />
        </button>
        {error != null && (
          <p className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {error}
          </p>
        )}
      </>
    );
  };

  return (
    <>
      <Dialog
        title={t('generalDesk.editTitle')}
        verb={saving ? t('orgGeneral.saving') : t('generalDesk.save')}
        on={changes > 0 && !saving && refused == null}
        locked={saving}
        onDismiss={() => {
          if (saving) return;
          if (changes > 0 && refused == null) setAsking(true);
          else onClose();
        }}
        onConfirm={() => void save()}
      >
        {refused != null && (
          <DialogAlert alertRef={alertRef}>{t(`orgGeneral.${refused}`)}</DialogAlert>
        )}
        {refused == null && failed && <DialogAlert>{t('orgGeneral.failed')}</DialogAlert>}
        <div className="desk-fields">
          <Field
            label={t('orgGeneral.name')}
            value={values.name}
            autoComplete="organization"
            inputRef={nameRef}
            error={errors.name ?? null}
            onChange={(value) => typed('name', value)}
          />
          {pickerRow('countryCode')}
          <Field
            label={t('orgGeneral.contact')}
            value={values.contactAddress}
            inputMode="email"
            autoComplete="email"
            inputRef={contactRef}
            error={errors.contactAddress ?? null}
            onChange={(value) => typed('contactAddress', value)}
          />
        </div>
        <div className="desk-group-in">
          <Head title={t('generalDesk.defaults')} level={3} />
          <ul className="desk-rows">
            {DEFAULTS.map((field) => (
              <li key={field}>{pickerRow(field)}</li>
            ))}
          </ul>
          <p className="desk-note">{t('orgGeneral.defaultsNote')}</p>
        </div>
        <div className="desk-group-in">
          <Head title={t('generalDesk.invitations')} level={3} />
          {pickerRow('locale')}
          <p className="desk-note">{t('orgGeneral.languageHint')}</p>
        </div>
      </Dialog>
      {picking != null && (
        <Picker
          back={t('generalDesk.editTitle')}
          title={t(LABEL[picking])}
          search={t(SEARCH[picking])}
          choices={choices[picking]}
          value={values[picking]}
          locale={locale}
          onBack={() => back(picking)}
          onChoose={(code) => back(picking, code)}
        />
      )}
      {asking && (
        <Ask
          title={t('generalDesk.discard', { count: changes })}
          line={t('generalDesk.discardDetails', { organisation: organisation.name })}
          keep={t('generalDesk.keepEditing')}
          go={t('generalDesk.discardVerb')}
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}

export function AddDomainDialog({
  organisation,
  list,
  onClose,
  onAdded,
}: {
  organisation: Membership;
  list: CompanyDomains;
  onClose: () => void;
  onAdded: (list: CompanyDomains, domain: string) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const example = domainOf(list.ownAddress) ?? 'example.com';

  async function add(): Promise<void> {
    if (busy) return;
    const problem = companyDomainProblem(typed);

    if (problem != null) {
      setError(
        problem === 'blank'
          ? t('companyDomains.blank', { example })
          : t('companyDomains.shape', { example }),
      );
      input.current?.focus();
      return;
    }

    setBusy(true);

    try {
      const domain = normaliseDomain(typed);
      onAdded(await api.addCompanyDomain(organisation.id, domain), domain);
    } catch (refusal) {
      setBusy(false);
      const violation =
        refusal instanceof ApiError && refusal.is('validation_failed')
          ? refusal.problem.violations?.find((one) => one.propertyPath === 'domain')
          : undefined;
      setError(violation?.message ?? t('companyDomains.failed'));
      input.current?.focus();
    }
  }

  return (
    <>
      <Dialog
        title={t('companyDomains.addLabel')}
        verb={t('generalDesk.addVerb')}
        on={typed.trim() !== '' && !busy}
        locked={busy}
        first={input}
        onDismiss={() => {
          if (busy) return;
          if (typed.trim() === '') onClose();
          else setAsking(true);
        }}
        onConfirm={() => void add()}
      >
        <div className="desk-fields">
          <Field
            label={t('generalDesk.domainField')}
            value={typed}
            placeholder={example}
            help={
              list.ownAddress == null
                ? t('companyDomains.helpNoAddress', { count: list.most })
                : t('companyDomains.help', { email: list.ownAddress, count: list.most })
            }
            error={error}
            inputRef={input}
            autoComplete="off"
            onChange={(value) => {
              setTyped(value);
              setError(null);
            }}
          />
        </div>
      </Dialog>
      {asking && (
        <Ask
          title={t('generalDesk.discard', { count: 1 })}
          line={t('generalDesk.discardDomain')}
          keep={t('generalDesk.keepEditing')}
          go={t('generalDesk.discardVerb')}
          onKeep={() => setAsking(false)}
          onGo={onClose}
        />
      )}
    </>
  );
}

/** What stops the dialog's answer, in its body, where the reader starts. */
export function DialogAlert({
  children,
  alertRef,
}: {
  children: string;
  alertRef?: RefObject<HTMLParagraphElement | null>;
}) {
  return (
    <p
      ref={alertRef}
      className="desk-ask-alert"
      role="alert"
      tabIndex={alertRef == null ? undefined : -1}
    >
      <Glyph name="alert" size={18} weight={2.2} />
      {children}
    </p>
  );
}

function focusSoon(find: () => HTMLElement | null | undefined, tries = 5): void {
  window.requestAnimationFrame(() => {
    const to = find();
    if (to == null) return;
    if (to.closest('[inert]') == null) to.focus();
    else if (tries > 0) focusSoon(find, tries - 1);
  });
}
