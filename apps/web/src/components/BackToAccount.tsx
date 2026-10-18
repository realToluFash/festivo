import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

function accountHref(verified: string | null): string {
  return verified == null
    ? '/app/account'
    : `/app/account?verified=${encodeURIComponent(verified)}`;
}

/** "← Back to Account" on a verify screen opened from Account (sc-2304), where onboarding shows its steps. */
export function BackToAccount({ verified }: { verified: string | null }) {
  const { t } = useTranslation();

  return (
    <Link className="link-button auth-back" to={accountHref(verified)}>
      <span aria-hidden="true">← </span>
      {t('contacts.backToAccount')}
    </Link>
  );
}

export function BackToAccountButton({ verified }: { verified: string }) {
  const { t } = useTranslation();

  return (
    <Link className="button button-primary" to={accountHref(verified)}>
      {t('contacts.backToAccount')}
    </Link>
  );
}

/** A wrong address or number is removed in Account, by the row's own Remove: this link removes nothing. */
export function RemoveInAccount({ kind }: { kind: 'email' | 'phone' }) {
  const { t } = useTranslation();
  const email = kind === 'email';

  return (
    <div className="auth-footnote">
      <span>{email ? t('verifyEmail.wrongAddress') : t('verifyPhone.wrongNumber')}</span>
      <Link className="link-button" to={accountHref(null)}>
        {email ? t('contacts.removeInAccount') : t('contacts.removeInAccountPhone')}
      </Link>
    </div>
  );
}
