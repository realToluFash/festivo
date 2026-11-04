import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { useResendCountdown } from '../resendCountdown.ts';

/** The parts creating an account shares across its steps (WebNewAccount, page 27). */

/** The header's right end from the email code on: who is signing up, and the way out. */
export function SignedInAs({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="auth-new">
      <span>{email}</span>
      <button className="button auth-new-button" type="button" onClick={onSignOut}>
        {t('completeProfile.signOut')}
      </button>
    </div>
  );
}

export function HaveAccount() {
  const { t } = useTranslation();

  return (
    <div className="auth-new">
      <span>{t('register.haveAccount')}</span>
      <Link className="button auth-new-button" to="/sign-in">
        {t('register.signIn')}
      </Link>
    </div>
  );
}

/** GOV.UK's back link, above the step line. */
export function ColumnBack({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();

  return (
    <button className="link-button auth-column-back" type="button" onClick={onClick}>
      <Chevron />
      {t('onboarding.back')}
    </button>
  );
}

export function StepLine({ step }: { step: 1 | 2 }) {
  const { t } = useTranslation();

  return <p className="auth-step">{t('onboarding.step', { step })}</p>;
}

export function Tick({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="auth-tick">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" className="auth-chevron">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

/** "No code? Send a new code in 0:41", the countdown's button a link once it ends; the note under it. */
export function ResendLine({
  resending,
  note,
  onResend,
  children,
}: {
  resending: ReturnType<typeof useResendCountdown>;
  note: string;
  onResend: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="auth-resend">
      <p className="auth-resend-line">
        <span>{t('onboarding.noCode')}</span>
        <button className="link-button" type="button" {...resending.button} onClick={onResend}>
          {resending.label}
        </button>
      </p>
      <p className="auth-resend-note">{note}</p>
      <span className="visually-hidden" role="status">
        {resending.status}
      </span>
      {children}
    </div>
  );
}
