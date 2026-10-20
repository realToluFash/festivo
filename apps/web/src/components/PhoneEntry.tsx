import { callingCode, countryChoices } from '@soirely/domain';
import { type ReactNode, type RefObject, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { currentLocale } from '../i18n/index.ts';
import { FieldError } from './FieldError.tsx';

/** The code and the number side by side, as Verify phone draws them; only countries that can be dialled. */
export function PhoneEntry({
  label,
  country,
  number,
  error,
  disabled,
  help,
  inputRef,
  onCountry,
  onNumber,
}: {
  label: ReactNode;
  country: string;
  number: string;
  error: string | null;
  disabled: boolean;
  help: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onCountry: (code: string) => void;
  onNumber: (typed: string) => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const countries = useMemo(
    () => countryChoices(locale).filter(({ code }) => callingCode(code) != null),
    [locale],
  );

  return (
    <>
      <div className="phone-entry">
        <div className="field phone-country">
          <label htmlFor="phone-country">{t('verifyPhone.countryLabel')}</label>
          <select
            className="input"
            id="phone-country"
            value={country}
            disabled={disabled}
            onChange={(event) => onCountry(event.target.value)}
          >
            <option value="" disabled hidden />
            {countries.map(({ code, name }) => (
              <option key={code} value={code}>
                {`${callingCode(code) ?? ''} ${name}`}
              </option>
            ))}
          </select>
        </div>

        <div className="field phone-number">
          <label htmlFor="phone-number">{label}</label>
          <input
            ref={inputRef}
            className={error == null ? 'input' : 'input input-wrong'}
            id="phone-number"
            type="tel"
            autoComplete="tel-national"
            value={number}
            disabled={disabled}
            aria-invalid={error != null}
            aria-describedby={error == null ? 'phone-help' : 'phone-error phone-help'}
            onChange={(event) => onNumber(event.target.value)}
          />
        </div>
      </div>

      {error != null && <FieldError id="phone-error" message={error} />}

      <p className="field-help" id="phone-help">
        {help}
      </p>
    </>
  );
}
