import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';

import { Confirm } from './Confirm.tsx';

/** Holds every way out while the form is sending, asks before one loses what was typed, and lets go once `release` has been called for a navigation the form makes itself. */
export function useLeaveGuard({
  dirty,
  busy,
  body,
}: {
  dirty: boolean;
  busy: boolean;
  body: string;
}): { release: () => void; dialog: ReactNode } {
  const { t } = useTranslation();
  const released = useRef(false);
  const blocker = useBlocker(
    useCallback(() => !released.current && (busy || dirty), [busy, dirty]),
  );

  useEffect(() => {
    if (!dirty) return;

    const ask = (event: BeforeUnloadEvent): void => event.preventDefault();
    window.addEventListener('beforeunload', ask);

    return () => window.removeEventListener('beforeunload', ask);
  }, [dirty]);

  const release = useCallback(() => {
    released.current = true;
  }, []);

  const dialog =
    blocker.state === 'blocked' && !busy ? (
      <Confirm
        id="event-leave"
        title={t('eventEdit.leaveTitle')}
        body={body}
        go={t('eventEdit.leave')}
        pending={false}
        opensPage
        onGo={() => blocker.proceed()}
        onKeep={() => blocker.reset()}
      />
    ) : null;

  return { release, dialog };
}
