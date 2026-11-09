import { useEffect, useRef, useSyncExternalStore } from 'react';

import { subscribeWebPush } from './webPush.ts';

function permissionNow(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

function onReturn(changed: () => void): () => void {
  const visible = () => {
    if (document.visibilityState === 'visible') changed();
  };
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('focus', changed);

  return () => {
    document.removeEventListener('visibilitychange', visible);
    window.removeEventListener('focus', changed);
  };
}

/**
 * Whether this browser blocks Soirely's pushes, read again whenever the tab comes back (sc-30243):
 * a browser says nothing when its reader allows notifications in its settings.
 */
export function usePushBlocked(): boolean {
  const permission = useSyncExternalStore(onReturn, permissionNow);
  const was = useRef(permission);

  useEffect(() => {
    if (permission === 'granted' && was.current !== 'granted') {
      void subscribeWebPush().catch(() => undefined);
    }
    was.current = permission;
  }, [permission]);

  return permission === 'denied';
}
