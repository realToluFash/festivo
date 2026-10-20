import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { dropRecovery } from '../../heldRecovery.ts';

type Status = { kind: 'asking' } | { kind: 'working' } | { kind: 'done' } | { kind: 'broken' };

/** "This wasn't me" from a recovery email. It waits for a press: a mail scanner opening the link must not sign anybody out. */
export function RecoveryNotMe() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const request = params.get('request') ?? '';
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<Status>(
    request === '' || token === '' ? { kind: 'broken' } : { kind: 'asking' },
  );

  async function confirm(): Promise<void> {
    setStatus({ kind: 'working' });

    try {
      await api.recoveryNotMe(request, token);
      dropRecovery();
      setStatus({ kind: 'done' });
    } catch {
      setStatus({ kind: 'broken' });
    }
  }

  return (
    <AuthPage>
      {status.kind === 'done' ? (
        <div className="auth-heading">
          <h1>{t('lostTwoFactor.notMeDoneTitle')}</h1>
          <p role="status">{t('lostTwoFactor.notMeDone')}</p>
        </div>
      ) : status.kind === 'broken' ? (
        <div className="auth-heading">
          <h1>{t('lostTwoFactor.notMeTitle')}</h1>
          <p role="alert">{t('lostTwoFactor.notMeBroken')}</p>
        </div>
      ) : (
        <>
          <div className="auth-heading">
            <h1>{t('lostTwoFactor.notMeTitle')}</h1>
            <p>{t('lostTwoFactor.notMeIntro')}</p>
          </div>
          <button
            className="button button-primary"
            type="button"
            aria-busy={status.kind === 'working'}
            onClick={() => void confirm()}
          >
            {t('lostTwoFactor.notMeButton')}
          </button>
        </>
      )}
      <Link className="link-button" to="/sign-in">
        {t('lostTwoFactor.back')}
      </Link>
    </AuthPage>
  );
}
