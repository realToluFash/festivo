import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { takeLinkedNotice } from '../googleSignIn.ts';

/** Shown once, on whatever screen the first sign-in that linked Google lands on. */
export function LinkedNotice() {
  const { t } = useTranslation();
  const [shown, setShown] = useState(takeLinkedNotice);

  if (!shown) return null;

  return (
    <div className="notice notice-done" role="status">
      <span className="mark mark-done" aria-hidden="true">
        ✓
      </span>
      <p className="notice-title">{t('oauth.linked', { provider: 'Google' })}</p>
      <button className="link-button notice-dismiss" type="button" onClick={() => setShown(false)}>
        {t('oauth.dismiss')}
      </button>
    </div>
  );
}
