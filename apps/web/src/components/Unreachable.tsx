import { useTranslation } from 'react-i18next';

import { retrySession, useSessionState } from '../session.ts';
import { LanguageChoice } from './LanguageChoice.tsx';

/** No sign-in heading or form: the person is still signed in, and those would say otherwise. */
export function Unreachable() {
  const { t } = useTranslation();
  const state = useSessionState();
  const retrying = state.status === 'unreachable' && state.retrying;

  return (
    <div className="auth">
      <header className="auth-header">
        <span className="brand">{t('app.name')}</span>
        <LanguageChoice />
      </header>

      <main id="content" className="auth-main">
        <section className="auth-card">
          <div className="notice notice-quiet" role="status">
            <span className="mark mark-info" aria-hidden="true">
              i
            </span>
            <div className="notice-body">
              <h1 className="notice-heading">{t('session.unreachableTitle')}</h1>
              <p>{t('session.unreachableBody')}</p>
            </div>
          </div>

          <button
            className="button button-primary"
            type="button"
            disabled={retrying}
            aria-busy={retrying}
            onClick={() => void retrySession()}
          >
            {retrying ? t('session.retrying') : t('error.retry')}
          </button>
        </section>
      </main>
    </div>
  );
}
