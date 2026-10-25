import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { LinkRetry } from '../linkRetry.ts';
import { retrySession, useSessionState } from '../session.ts';
import { LanguageChoice } from './LanguageChoice.tsx';

/** No sign-in heading or form, which would tell somebody signed in otherwise. Without `retry`, Try again reads the account. */
export function Unreachable({ signedIn, retry }: { signedIn: boolean; retry?: LinkRetry }) {
  const { t } = useTranslation();
  const state = useSessionState();
  const retrying = retry?.retrying ?? (state.status === 'unreachable' && state.retrying);
  const notice = useRef<HTMLDivElement>(null);
  const wasRetrying = useRef(false);
  const linked = retry != null;

  useEffect(() => {
    if (linked && wasRetrying.current && !retrying) notice.current?.focus();
    wasRetrying.current = retrying;
  }, [linked, retrying]);

  return (
    <div className="auth">
      <header className="auth-header">
        <span className="brand">{t('app.name')}</span>
        <LanguageChoice />
      </header>

      <main id="content" className="auth-main">
        <section className="auth-card">
          <div
            ref={notice}
            className="notice notice-quiet"
            role="status"
            tabIndex={linked ? -1 : undefined}
          >
            <span className="mark mark-info" aria-hidden="true">
              i
            </span>
            <div className="notice-body">
              <h1 className="notice-heading">{t('session.unreachableTitle')}</h1>
              <p>
                {signedIn ? t('session.unreachableBody') : t('session.unreachableBodySignedOut')}
              </p>
            </div>
          </div>

          <button
            className="button button-primary"
            type="button"
            disabled={retrying}
            aria-busy={retrying}
            onClick={() => void (retry == null ? retrySession() : retry.again())}
          >
            {retrying ? t('session.retrying') : t('error.retry')}
          </button>
        </section>
      </main>
    </div>
  );
}
