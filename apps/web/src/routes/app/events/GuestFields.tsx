import { callingCode, countryChoices } from '@soirely/domain';
import { type ReactNode, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { codeChoice } from '../../../phoneProblem.ts';

export function CompanionField({
  at,
  name,
  label,
  remove,
  placeholder,
  error,
  onChange,
  onRemove,
}: {
  at: number;
  name: string;
  label: string;
  remove: string;
  placeholder: string;
  error: string | undefined;
  onChange: (name: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="gs-companion-field">
      <div className="gs-companion">
        <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            type="text"
            value={name}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            data-focus={`companion-${at}`}
            aria-label={label}
            aria-invalid={error != null}
            aria-describedby={error == null ? undefined : `${id}-error`}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="desk-text gs-remove"
          aria-label={remove}
          onClick={onRemove}
        >
          {t('guestList.remove')}
        </button>
      </div>
      {error != null && <FieldWrong id={`${id}-error`}>{error}</FieldWrong>}
    </div>
  );
}

export function FieldWrong({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="desk-error">
      <Glyph name="alert" size={15} weight={2.2} />
      {children}
    </p>
  );
}

export function GuestField({
  label,
  value,
  optional = false,
  error,
  focusKey,
  type = 'text',
  onChange,
}: {
  label: string;
  value: string;
  optional?: boolean;
  error: string | undefined;
  focusKey: string;
  type?: 'text' | 'email';
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label gs-label">
        {label}
        {optional && <span className="gs-optional">{t('eventForm.optional')}</span>}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type={type}
          value={value}
          autoComplete="off"
          spellCheck={false}
          data-focus={focusKey}
          aria-invalid={error != null}
          aria-describedby={error == null ? undefined : `${id}-error`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error != null && <FieldWrong id={`${id}-error`}>{error}</FieldWrong>}
    </div>
  );
}

/** The account's Mobile number: the code and the number side by side, only countries that can be dialled. */
export function PhoneField({
  country,
  number,
  error,
  help,
  onCountry,
  onNumber,
}: {
  country: string;
  number: string;
  error: string | undefined;
  help?: string;
  onCountry: (code: string) => void;
  onNumber: (number: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const told = [help == null ? null : `${id}-help`, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');
  const locale = currentLocale();
  const countries = useMemo(
    () => countryChoices(locale).filter(({ code }) => callingCode(code) != null),
    [locale],
  );

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label gs-label">
        {t('verifyPhone.numberLabel')}
        <span className="gs-optional">{t('eventForm.optional')}</span>
      </label>
      <div className="gs-phone">
        <div className="desk-box gs-country">
          <span aria-hidden="true">{`${country} ${callingCode(country) ?? ''}`.trim()}</span>
          <Glyph name="chevdown" size={15} weight={2.4} />
          <select
            aria-label={t('guestList.country')}
            value={country}
            data-focus="country"
            onChange={(event) => onCountry(event.target.value)}
          >
            <option value="" disabled hidden />
            {countries.map(({ code, name }) => (
              <option key={code} value={code}>
                {codeChoice(code, name)}
              </option>
            ))}
          </select>
        </div>
        <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
          <input
            id={id}
            type="tel"
            value={number}
            autoComplete="off"
            data-focus="mobile"
            aria-invalid={error != null}
            aria-describedby={told === '' ? undefined : told}
            onChange={(event) => onNumber(event.target.value)}
          />
        </div>
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      {error != null && <FieldWrong id={`${id}-error`}>{error}</FieldWrong>}
    </div>
  );
}
