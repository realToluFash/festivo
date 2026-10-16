import { type Account, ApiError } from '@soirely/api-client';
import {
  callingCode,
  countryChoices,
  deviceCountry,
  formatPhone,
  phoneLengthProblem,
} from '@soirely/domain';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { LanguageChoice } from '../../components/LanguageChoice.tsx';
import { Pending } from '../../components/Pending.tsx';
import { currentLocale } from '../../i18n/index.ts';

/** "Change your mobile number", which is also where a first number is entered. */
export function ChangePhone() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const onboarding = params.get('from') === 'onboarding';
  const [account, setAccount] = useState<Account | 'none' | null>(null);

  useEffect(() => {
    let live = true;

    api
      .me()
      .then((me) => {
        if (live) setAccount(me);
      })
      .catch(() => {
        if (live) setAccount('none');
      });

    return () => {
      live = false;
    };
  }, []);

  if (account === 'none') return <Navigate to="/sign-in" replace />;
  if (account == null) return <Pending />;

  const current = account.phoneNumbers.find((phone) => phone.primary) ?? null;

  return (
    <div className="auth">
      <header className="auth-header">
        <span className="brand">{t('app.name')}</span>
        <LanguageChoice />
      </header>

      <main id="content" className="auth-main">
        <section className="auth-card">
          <div className="auth-heading">
            <h1>{t('verifyPhone.changeTitle')}</h1>
            {current != null && (
              <p>
                {t(current.verified ? 'verifyPhone.nowVerified' : 'verifyPhone.nowUnverified', {
                  number: formatPhone(current.number),
                })}
              </p>
            )}
          </div>

          {current != null && (
            <div className="notice notice-quiet">
              <span className="mark mark-info" aria-hidden="true">
                i
              </span>
              <p>{t('verifyPhone.changeNotice')}</p>
            </div>
          )}

          <NumberForm
            initialCountry={current?.countryCode ?? deviceCountry(navigator.languages) ?? 'NG'}
            onTexted={() =>
              navigate(onboarding ? '/verify-phone?from=onboarding' : '/verify-phone')
            }
          />

          {current != null && (
            <button className="link-button" type="button" onClick={() => navigate(-1)}>
              {t('verifyPhone.keep')}
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

function NumberForm({
  initialCountry,
  onTexted,
}: {
  initialCountry: string;
  onTexted: () => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const countries = useMemo(
    () => countryChoices(locale).filter(({ code }) => callingCode(code) != null),
    [locale],
  );
  const [country, setCountry] = useState(initialCountry);
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const countryName = countries.find(({ code }) => code === country)?.name ?? country;

  async function send(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const problem = phoneLengthProblem(number, country);

    if (problem != null) {
      setError(
        problem === 'blank'
          ? t('verifyPhone.numberBlank')
          : t(problem === 'tooShort' ? 'verifyPhone.tooShort' : 'verifyPhone.tooLong', {
              country: countryName,
            }),
      );
      return;
    }

    setSending(true);

    try {
      await api.setPhone(country, number);
      onTexted();
    } catch (refusal) {
      setSending(false);

      if (refusal instanceof ApiError && refusal.is('phone_taken')) {
        setError(t('verifyPhone.taken'));
      } else if (refusal instanceof ApiError && refusal.is('validation_failed')) {
        setError(Object.values(refusal.fieldErrors())[0] ?? t('verifyPhone.failedBody'));
      } else {
        setError(t('verifyPhone.failedBody'));
      }
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={(event) => void send(event)}>
      <div className="phone-entry">
        <div className="field phone-country">
          <label htmlFor="phone-country">{t('verifyPhone.countryLabel')}</label>
          <select
            className="input"
            id="phone-country"
            value={country}
            disabled={sending}
            onChange={(event) => {
              setCountry(event.target.value);
              setError(null);
            }}
          >
            {countries.map(({ code, name }) => (
              <option key={code} value={code}>
                {`${callingCode(code) ?? ''} ${name}`}
              </option>
            ))}
          </select>
        </div>

        <div className="field phone-number">
          <label htmlFor="phone-number">{t('verifyPhone.numberLabel')}</label>
          <input
            className={error == null ? 'input' : 'input input-wrong'}
            id="phone-number"
            type="tel"
            autoComplete="tel-national"
            value={number}
            disabled={sending}
            aria-invalid={error != null}
            aria-describedby={error == null ? 'phone-help' : 'phone-error phone-help'}
            onChange={(event) => {
              setNumber(event.target.value);
              setError(null);
            }}
          />
        </div>
      </div>

      {error != null && (
        <div className="field-error" id="phone-error" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <p>{error}</p>
        </div>
      )}

      <p className="field-help" id="phone-help">
        {t('verifyPhone.numberHelp')}
      </p>

      <button className="button button-primary" type="submit" aria-busy={sending}>
        {sending ? t('verifyPhone.sending') : t('verifyPhone.send')}
      </button>
    </form>
  );
}
