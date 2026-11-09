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

/** Read again whenever the tab comes back: a browser says nothing when push is allowed in its settings (sc-30243). */
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
