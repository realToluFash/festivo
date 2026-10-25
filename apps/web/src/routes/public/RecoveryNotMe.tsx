import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { AuthPage } from '../../components/AuthPage.tsx';
import { dropRecovery } from '../../heldRecovery.ts';
import { useStepFocus } from '../../stepFocus.ts';

type Status =
  | { kind: 'asking' }
  | { kind: 'working' }
  | { kind: 'done' }
  | { kind: 'broken'; pressed: boolean };

/** "This wasn't me" from a recovery email. It waits for a press: a mail scanner opening the link must not sign anybody out. */
export function RecoveryNotMe() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const request = params.get('request') ?? '';
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<Status>(
    request === '' || token === '' ? { kind: 'broken', pressed: false } : { kind: 'asking' },
  );
  const [doneHeading, arriveAtDone] = useStepFocus();
  const [brokenLine, arriveAtBroken] = useStepFocus<HTMLParagraphElement>();

  async function confirm(): Promise<void> {
    setStatus({ kind: 'working' });

    try {
      await api.recoveryNotMe(request, token);
      dropRecovery();
      setStatus({ kind: 'done' });
      arriveAtDone();
    } catch {
      setStatus({ kind: 'broken', pressed: true });
      arriveAtBroken();
    }
  }

  return (
    <AuthPage>
      {status.kind === 'done' ? (
        <div className="auth-heading">
          <h1 ref={doneHeading} tabIndex={-1}>
            {t('lostTwoFactor.notMeDoneTitle')}
          </h1>
          <p>{t('lostTwoFactor.notMeDone')}</p>
        </div>
      ) : status.kind === 'broken' ? (
        <div className="auth-heading">
          <h1>{t('lostTwoFactor.notMeTitle')}</h1>
          {status.pressed ? (
            <p ref={brokenLine} tabIndex={-1}>
              {t('lostTwoFactor.notMeBroken')}
            </p>
          ) : (
            <p role="alert">{t('lostTwoFactor.notMeBroken')}</p>
          )}
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
