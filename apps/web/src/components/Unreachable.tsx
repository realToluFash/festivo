import { useTranslation } from 'react-i18next';

import { retrySession } from '../session.ts';

/** Stands where sign-in would, because sign-in would read as being signed out. */
export function Unreachable() {
  const { t } = useTranslation();

  return (
    <main id="content" className="unreachable">
      <div className="notice notice-broken" role="alert">
        <span className="mark mark-broken" aria-hidden="true">
          ✕
        </span>
        <div className="notice-body">
          <p className="notice-title">{t('session.unreachableTitle')}</p>
          <p>{t('session.unreachableBody')}</p>
        </div>
        <button className="button" type="button" onClick={retrySession}>
          {t('error.retry')}
        </button>
      </div>
    </main>
  );
}
