import type { Membership } from '@soirely/api-client';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { api } from '../api.ts';
import { forgetSession } from '../session.ts';

/** In place of every page of an organisation whose deadline for two-factor has passed (sc-609). */
export function TwoFactorOverdue({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function signOut(): Promise<void> {
    await api.signOut().catch(() => {});
    forgetSession();
    navigate('/sign-in');
  }

  return (
    <section className="card settings-card two-factor-overdue" aria-labelledby="overdue-title">
      <h1 id="overdue-title">{t('signInRules.overdueTitle')}</h1>
      <p>{t('signInRules.overdueBody', { organisation: organisation.name })}</p>
      <p className="muted">{t('signInRules.overdueElsewhere')}</p>
      <div className="actions">
        <Link className="button button-primary" to="/app/account/security">
          {t('signInRules.overdueTurnOn')}
        </Link>
        <button className="button" type="button" onClick={() => void signOut()}>
          {t('signInRules.overdueSignOut')}
        </button>
      </div>
    </section>
  );
}
