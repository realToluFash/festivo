import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/** Where a sign-out could not reach Soirely, said where the button is (sc-11571). */
export function StillSignedIn() {
  const { t } = useTranslation();
  const notice = useRef<HTMLDivElement>(null);

  useEffect(() => {
    notice.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  return (
    <div ref={notice} className="notice notice-broken" role="alert">
      <span className="mark mark-broken" aria-hidden="true">
        ✕
      </span>
      <div className="notice-body">
        <p className="notice-title">{t('session.stillSignedInTitle')}</p>
        <p>{t('session.stillSignedInBody')}</p>
      </div>
    </div>
  );
}
