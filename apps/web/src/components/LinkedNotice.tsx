import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { takeLinkedNotice } from '../providerSignIn.ts';

/** Shown once, on whatever screen the first sign-in that linked a provider lands on. */
export function LinkedNotice() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState(takeLinkedNotice);

  if (provider == null) return null;

  return (
    <div className="notice notice-done" role="status">
      <span className="mark mark-done" aria-hidden="true">
        ✓
      </span>
      <p className="notice-title">{t('oauth.linked', { provider })}</p>
      <button
        className="link-button notice-dismiss"
        type="button"
        onClick={() => setProvider(null)}
      >
        {t('oauth.dismiss')}
      </button>
    </div>
  );
}
