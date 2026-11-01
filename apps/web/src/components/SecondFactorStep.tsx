import { ApiError, type SecondFactor } from '@soirely/api-client';
import { cleanCode, codeProblem, formatTimeOfDay, lockLiftsAt } from '@soirely/domain';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { dateLocale } from '../i18n/index.ts';
import { offButton } from '../offButton.ts';
import { focusWhereSent, offField } from '../offField.ts';
import type { ForgotFrom } from '../forgotFrom.ts';
import { FieldError } from './FieldError.tsx';

type Mode = 'app' | 'recovery';

type Status =
  | { kind: 'ready' }
  | { kind: 'checking' }
  | { kind: 'wrong'; message: string }
  | { kind: 'paused'; time: string; liftsAt: number }
  | { kind: 'failed' };

/** "Enter your code", for any step a second factor guards: a sign-in, or a password reset. */
export function SecondFactorStep({
  intro,
  recoveryIntro,
  submitLabel,
  pausedNote,
  failedTitle,
  failedBody,
  onLostBoth,
  onVerify,
  onExpired,
}: {
  intro: string;
  recoveryIntro: string;
  submitLabel: string;
  pausedNote?: string;
  failedTitle: string;
  failedBody: string;
  /** Only where a sign-in asks: the way back in for somebody who has neither (sc-509). */
  onLostBoth?: () => void;
  onVerify: (factor: SecondFactor) => Promise<void>;
  onExpired: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('app');
  const [typed, setTyped] = useState('');
  const [blank, setBlank] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'ready' });

  const checking = status.kind === 'checking';
  const liftsAt = status.kind === 'paused' ? status.liftsAt : null;
  const error = blank ?? (status.kind === 'wrong' ? status.message : null);

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = window.setTimeout(
      () => {
        setTyped('');
        setStatus({ kind: 'ready' });
      },
      Math.max(0, liftsAt - Date.now()),
    );

    return () => window.clearTimeout(lift);
  }, [liftsAt]);

  function switchTo(next: Mode): void {
    setMode(next);
    setTyped('');
    setBlank(null);
    if (status.kind === 'wrong') setStatus({ kind: 'ready' });
  }

  // Checked before sending, and a failed check costs no attempt.
  function problem(): string | null {
    if (mode === 'recovery') return typed.trim() === '' ? t('twoFactor.recoveryBlank') : null;

    const found = codeProblem(typed);

    return found === 'blank'
      ? t('twoFactor.codeBlank')
      : found === 'short'
        ? t('twoFactor.codeLength')
        : null;
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (checking || status.kind === 'paused') return;

    const found = problem();
    setBlank(found);
    if (found != null) {
      document.getElementById('code')?.focus();
      return;
    }

    setStatus({ kind: 'checking' });
    const land = focusWhereSent();

    try {
      await onVerify(mode === 'app' ? { code: cleanCode(typed) } : { recoveryCode: typed.trim() });
      setStatus({ kind: 'ready' });
    } catch (refusal) {
      if (refusal instanceof ApiError && refusal.is('two_factor_challenge_invalid')) {
        onExpired();
        return;
      }

      const next = statusFrom(refusal, mode, t);
      setStatus(next);
      if (next.kind === 'wrong') land('code');
    }
  }

  return (
    <>
      <div className="auth-heading auth-heading-apart">
        <h1>{mode === 'app' ? t('twoFactor.title') : t('twoFactor.recoveryTitle')}</h1>
        <p>{mode === 'app' ? intro : recoveryIntro}</p>
      </div>

      {status.kind === 'paused' && (
        <div className="notice notice-attention" role="alert">
          <span className="mark mark-attention" aria-hidden="true">
            !
          </span>
          <div className="notice-body">
            <p className="notice-title">{t('twoFactor.pausedTitle')}</p>
            <p>{t('twoFactor.pausedBody', { time: status.time })}</p>
            {pausedNote != null && <p>{pausedNote}</p>}
            <div className="auth-footnote">
              <span>{t('twoFactor.notYou')}</span>
              <Link
                className="link-button"
                to="/forgot-password"
                state={{ back: 'code' } satisfies ForgotFrom}
              >
                {t('twoFactor.resetPassword')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {status.kind === 'failed' && (
        <div className="notice notice-broken" role="alert">
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p className="notice-title">{failedTitle}</p>
            <p>{failedBody}</p>
          </div>
        </div>
      )}

      <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="field">
          <label htmlFor="code">
            {mode === 'app' ? t('twoFactor.code') : t('twoFactor.recoveryCode')}
          </label>
          <input
            className={error == null ? 'input input-figures' : 'input input-figures input-wrong'}
            id="code"
            name="code"
            type="text"
            {...(mode === 'app'
              ? { inputMode: 'numeric' as const, autoComplete: 'one-time-code' }
              : { autoComplete: 'off', autoCapitalize: 'none' })}
            autoCorrect="off"
            spellCheck={false}
            value={typed}
            {...offField(checking)}
            aria-invalid={error != null}
            aria-describedby={error == null ? undefined : 'code-error'}
            onChange={(event) => {
              setTyped(event.target.value);
              setBlank(null);
              if (status.kind === 'wrong') setStatus({ kind: 'ready' });
            }}
          />
          {error != null && <FieldError id="code-error" message={error} />}
        </div>

        <button
          className="button button-primary"
          type="submit"
          aria-busy={checking}
          {...offButton(status.kind === 'paused')}
        >
          {status.kind === 'paused'
            ? t('twoFactor.tryAgainAt', { time: status.time })
            : mode === 'app'
              ? submitLabel
              : t('twoFactor.useThisCode')}
        </button>
      </form>

      <button
        className="auth-row"
        type="button"
        onClick={() => switchTo(mode === 'app' ? 'recovery' : 'app')}
      >
        {mode === 'app' ? t('twoFactor.useRecovery') : t('twoFactor.useApp')}
      </button>

      {onLostBoth != null && (
        <button className="auth-row" type="button" onClick={onLostBoth}>
          {t('twoFactor.lostBoth')}
        </button>
      )}

      <div className="auth-footnote auth-footnote-plain auth-footnote-centred">
        <Link className="link-button" to="/sign-in">
          {t('twoFactor.back')}
        </Link>
      </div>

      {onLostBoth == null && (
        <p className="auth-footnote auth-footnote-plain auth-footnote-centred">
          {t('twoFactor.lostBoth')}
        </p>
      )}
    </>
  );
}

function statusFrom(refusal: unknown, mode: Mode, t: (key: string) => string): Status {
  if (!(refusal instanceof ApiError)) return { kind: 'failed' };

  if (refusal.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(refusal.response?.headers.get('Retry-After')));

    if (liftsAt != null) {
      return {
        kind: 'paused',
        time: formatTimeOfDay(liftsAt, dateLocale()),
        liftsAt: liftsAt.getTime(),
      };
    }
  }

  if (refusal.is('recovery_code_used'))
    return { kind: 'wrong', message: t('twoFactor.recoveryUsed') };

  if (refusal.is('two_factor_code_invalid')) {
    return {
      kind: 'wrong',
      message: mode === 'app' ? t('twoFactor.codeWrong') : t('twoFactor.recoveryWrong'),
    };
  }

  return { kind: 'failed' };
}
