import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';

/** While a part has a change, every way off the page asks first, as main's `useLeaveGuard` does: the router's own ways in the demo's dialog, reload and the address bar in the browser's. */
export function useLeaveAsk(dirty: boolean): {
  blocked: boolean;
  stay: () => void;
  go: () => void;
  release: () => void;
} {
  const released = useRef(false);
  const blocker = useBlocker(useCallback(() => dirty && !released.current, [dirty]));

  useEffect(() => {
    if (!dirty) return;

    const ask = (event: BeforeUnloadEvent): void => event.preventDefault();
    window.addEventListener('beforeunload', ask);

    return () => window.removeEventListener('beforeunload', ask);
  }, [dirty]);

  return {
    blocked: blocker.state === 'blocked',
    stay: () => blocker.reset?.(),
    go: () => blocker.proceed?.(),
    release: () => {
      released.current = true;
    },
  };
}
