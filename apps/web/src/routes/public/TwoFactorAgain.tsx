import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { Pending } from '../../components/Pending.tsx';
import { refreshAccount, useSessionState } from '../../session.ts';

/** After an approved recovery (sc-509): set two-factor up again, or carry on and find it in Security. */
export function TwoFactorAgain() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useSessionState();
  const [skipping, setSkipping] = useState(false);

  if (state.status === 'signedOut') return <Navigate to="/sign-in" replace />;
  if (state.status !== 'signedIn') return <Pending />;

  async function notNow(): Promise<void> {
    setSkipping(true);
    await api.dismissTwoFactorPrompt().catch(() => {});
    await refreshAccount();
    navigate('/app', { replace: true });
  }

  return (
    <AuthPage>
      <div className="auth-heading auth-heading-apart">
        <h1>{t('lostTwoFactor.setupTitle')}</h1>
        <p>{t('lostTwoFactor.setupIntro')}</p>
      </div>
      <Link className="button button-primary" to="/app/account/security">
        {t('lostTwoFactor.setup')}
      </Link>
      <button className="button" type="button" aria-busy={skipping} onClick={() => void notNow()}>
        {t('lostTwoFactor.notNow')}
      </button>
      <p className="field-help">{t('lostTwoFactor.notNowNote')}</p>
    </AuthPage>
  );
}
