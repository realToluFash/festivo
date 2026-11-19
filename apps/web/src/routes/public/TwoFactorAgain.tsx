import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { SignedInAs } from '../../components/Onboarding.tsx';
import { PendingPage } from '../../components/Pending.tsx';
import { StillSignedIn } from '../../components/StillSignedIn.tsx';
import { Unreachable } from '../../components/Unreachable.tsx';
import { refreshAccount, restoreSession, useSessionState } from '../../session.ts';
import { useSignOut } from '../../signOut.ts';

/** After an approved recovery (sc-509): set two-factor up again, or carry on and find it in Security. */
export function TwoFactorAgain() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useSessionState();
  const [skipping, setSkipping] = useState(false);
  const { signOut, unreached } = useSignOut(() => navigate('/sign-in'));

  useEffect(() => {
    void restoreSession();
  }, []);

  if (state.status === 'signedOut') return <Navigate to="/sign-in" replace />;
  if (state.status === 'unreachable') return <Unreachable signedIn bare />;
  if (state.status !== 'signedIn') return <PendingPage />;

  async function notNow(): Promise<void> {
    setSkipping(true);
    await api.dismissTwoFactorPrompt().catch(() => {});
    await refreshAccount();
    navigate('/app', { replace: true });
  }

  return (
    <AuthPage
      bare
      end={<SignedInAs email={state.session.email} onSignOut={() => void signOut()} />}
    >
      <div className="auth-heading">
        <h1>{t('lostTwoFactor.setupTitle')}</h1>
        <p>{t('lostTwoFactor.setupIntro')}</p>
      </div>
      <div className="auth-buttons">
        <Link className="button button-primary" to="/app/account/security">
          {t('lostTwoFactor.setup')}
        </Link>
        <button className="button" type="button" aria-busy={skipping} onClick={() => void notNow()}>
          {t('lostTwoFactor.notNow')}
        </button>
      </div>
      <p className="field-help">{t('lostTwoFactor.notNowNote')}</p>
      {unreached && <StillSignedIn />}
    </AuthPage>
  );
}
