import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { linkedNotice, dropLinkedNotice } from '../providerSignIn.ts';
import { afterNotice, useFocusOnceShown } from '../stepFocus.ts';

/** Shown once, on whatever screen the first sign-in that linked a provider lands on. */
export function LinkedNotice() {
  const [provider, dismiss] = useLinkedProvider();

  return <LinkedNoticeFor provider={provider} onDismiss={dismiss} />;
}

/** The provider the first linking sign-in named, read once by whoever holds it, so a notice that moves between places keeps it. */
export function useLinkedProvider(): [string | null, () => void] {
  const [provider, setProvider] = useState(linkedNotice);

  // Removed only once committed: React may abandon a render and run the initializer again.
  useEffect(() => {
    if (provider != null) dropLinkedNotice();
  }, [provider]);

  return [provider, () => setProvider(null)];
}

export function LinkedNoticeFor({
  provider,
  onDismiss,
}: {
  provider: string | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const notice = useRef<HTMLDivElement>(null);
  const land = useFocusOnceShown();

  if (provider == null) return null;

  return (
    <div className="notice notice-done" role="status" ref={notice}>
      <span className="mark mark-done" aria-hidden="true">
        ✓
      </span>
      <div className="notice-action-row">
        <p className="notice-title" data-notice-lead tabIndex={-1}>
          {t('oauth.linked', { provider })}
        </p>
        <button
          className="link-button notice-dismiss"
          type="button"
          onClick={() => {
            const next = afterNotice(notice.current);
            onDismiss();
            land(() => next);
          }}
        >
          {t('oauth.dismiss')}
        </button>
      </div>
    </div>
  );
}
