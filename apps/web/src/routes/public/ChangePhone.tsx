import { type Account, ApiError } from '@soirely/api-client';
import {
  deviceCountry,
  formatPhone,
  phoneLengthProblem,
  phoneScreenCountry,
  refusedPhoneField,
} from '@soirely/domain';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { phoneProblemMessage } from '../../phoneProblem.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { Pending } from '../../components/Pending.tsx';
import { PhoneEntry } from '../../components/PhoneEntry.tsx';

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
    <AuthPage>
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
        initialCountry={phoneScreenCountry(
          current?.countryCode,
          account.countryCode,
          deviceCountry(navigator.languages),
        )}
        onTexted={() => navigate(onboarding ? '/verify-phone?from=onboarding' : '/verify-phone')}
      />

      {current != null && (
        <button className="link-button" type="button" onClick={() => navigate(-1)}>
          {t('verifyPhone.keep')}
        </button>
      )}
    </AuthPage>
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
  const [country, setCountry] = useState(initialCountry);
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const found = phoneLengthProblem(number, country);
    const problem = phoneProblemMessage(found, country, t);

    if (problem != null) {
      setError(problem);
      document
        .getElementById(refusedPhoneField(found) === 'country' ? 'phone-country' : 'phone-number')
        ?.focus();
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
      <PhoneEntry
        label={t('verifyPhone.numberLabel')}
        country={country}
        number={number}
        error={error}
        disabled={sending}
        help={t('verifyPhone.numberHelp')}
        onCountry={(code) => {
          setCountry(code);
          setError(null);
        }}
        onNumber={(typed) => {
          setNumber(typed);
          setError(null);
        }}
      />

      <button className="button button-primary" type="submit" aria-busy={sending}>
        {sending ? t('verifyPhone.sending') : t('verifyPhone.send')}
      </button>
    </form>
  );
}
