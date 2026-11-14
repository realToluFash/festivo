import { ApiError } from '@soirely/api-client';
import { formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { FieldError } from '../../components/FieldError.tsx';
import { ColumnBack, HaveAccount } from '../../components/Onboarding.tsx';
import { emailMessage, useFormChecks } from '../../formChecks.ts';
import { dateLocale } from '../../i18n/index.ts';
import { useStepFocus } from '../../stepFocus.ts';
import { offField } from '../../offField.ts';
import { useSessionState } from '../../session.ts';

type Status =
  | { kind: 'asking' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string; again: 'idle' | 'sending' | 'sent' }
  | { kind: 'limited'; time: string; again: boolean }
  | { kind: 'failed'; again: boolean };

/** "Reset your password": an address in, and the same answer whether or not it has an account. */
export function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const opened = location.key === 'default';
  const carried = location.state as { email?: string } | null;
  const signedIn = useSessionState().status === 'signedIn';
  const [status, setStatus] = useState<Status>({ kind: 'asking' });
  const [typed, setTyped] = useState(carried?.email ?? '');
  const [sentHeading, arriveAtSent] = useStepFocus();
  const [refusedNotice, arriveAtRefused] = useStepFocus<HTMLDivElement>();
  const checks = useFormChecks(
    ['email'] as const,
    (_field, value) => emailMessage(value, t),
    () => document.getElementById('email')?.focus(),
  );

  async function send(email: string): Promise<void> {
    setStatus({ kind: 'sending' });

    try {
      await api.forgotPassword(email);
      setStatus({ kind: 'sent', email, again: 'idle' });
      arriveAtSent();
    } catch (error) {
      setStatus(refusalFrom(error, false));
    }
  }

  async function sendAgain(email: string): Promise<void> {
    setStatus({ kind: 'sent', email, again: 'sending' });

    try {
      await api.forgotPassword(email);
      setStatus({ kind: 'sent', email, again: 'sent' });
    } catch (error) {
      setStatus(refusalFrom(error, true));
      arriveAtRefused();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (status.kind === 'sending') return;

    const email = typed.trim();
    if (!checks.passes({ email })) return;

    void send(email);
  }

  if (status.kind === 'sent') {
    const resending = status.again === 'sending';

    return (
      <AuthPage bare end={null}>
        <ColumnBack onClick={() => setStatus({ kind: 'asking' })} />
        <div className="auth-heading">
          <h1 ref={sentHeading} tabIndex={-1}>
            {t('recovery.sentTitle')}
          </h1>
          <p>{t('recovery.sentBody')}</p>
        </div>

        <div className="auth-asides">
          <p className="auth-aside">
            <span>
              <Trans
                i18nKey="recovery.nothingThere"
                components={{
                  send: (
                    <SendAgain
                      busy={resending}
                      onSend={() => {
                        if (!resending) void sendAgain(status.email);
                      }}
                    />
                  ),
                }}
              />
            </span>
            <span role="status">{status.again === 'sent' && t('recovery.sentAgain')}</span>
          </p>
          <p className="auth-aside">{t('recovery.providerNote')}</p>
          <p className="auth-aside">
            <span>{t('recovery.gotIt')}</span>
            <Link className="link-button" to="/sign-in">
              {t('recovery.backToSignIn')}
            </Link>
          </p>
        </div>
      </AuthPage>
    );
  }

  const refused = status.kind === 'limited' || status.kind === 'failed';

  return (
    <AuthPage bare end={signedIn ? null : <HaveAccount question={t('recovery.remembered')} />}>
      <ColumnBack
        onClick={() => (opened ? void navigate('/sign-in', { replace: true }) : void navigate(-1))}
      />
      <div className="auth-heading">
        <h1>{t('recovery.title')}</h1>
        <p>{t('recovery.intro')}</p>
        {refused && (
          <div
            className="auth-notice"
            role={status.again ? undefined : 'alert'}
            ref={refusedNotice}
            tabIndex={status.again ? -1 : undefined}
          >
            <p className="auth-notice-title">
              {status.kind === 'limited' ? t('recovery.limitedTitle') : t('recovery.failedTitle')}
            </p>
            <p>
              {status.kind === 'limited'
                ? t('recovery.limitedBody', { time: status.time })
                : t('recovery.failedBody')}
            </p>
          </div>
        )}
      </div>

      <form className="auth-form" noValidate onSubmit={submit}>
        <div className={checks.errors.email == null ? 'field' : 'field field-wrong'}>
          <label htmlFor="email">{t('recovery.email')}</label>
          <input
            className={checks.errors.email == null ? 'input' : 'input input-wrong'}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={typed}
            {...offField(status.kind === 'sending')}
            aria-invalid={checks.errors.email != null}
            aria-describedby={checks.errors.email == null ? undefined : 'email-error'}
            onBlur={(event) => checks.left('email', event.target.value)}
            onChange={(event) => {
              setTyped(event.target.value);
              checks.edited('email', event.target.value);
            }}
          />
          {checks.errors.email != null && (
            <FieldError id="email-error" message={checks.errors.email} />
          )}
        </div>

        <button
          className="button button-primary"
          type="submit"
          aria-busy={status.kind === 'sending'}
        >
          {status.kind === 'sending' ? t('recovery.sending') : t('recovery.send')}
        </button>
      </form>
    </AuthPage>
  );
}

/** "send it again", the link inside its sentence; its words are the sentence's own, or Sending… while it sends. */
function SendAgain({
  busy,
  onSend,
  children,
}: {
  busy: boolean;
  onSend: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <button className="link-button" type="button" aria-busy={busy} onClick={onSend}>
      {busy ? t('recovery.sending') : children}
    </button>
  );
}

function refusalFrom(error: unknown, again: boolean): Status {
  if (error instanceof ApiError && error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    if (liftsAt != null) {
      return { kind: 'limited', time: formatTimeOfDay(liftsAt, dateLocale()), again };
    }
  }

  return { kind: 'failed', again };
}
