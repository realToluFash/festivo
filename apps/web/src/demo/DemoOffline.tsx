import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { OfflineBoxLook } from '../components/OfflineBand.tsx';
import { EVENT_WORDS as W } from './events.ts';

/** The amber box above a page's title while offline: Events', and on the Calendar and every Settings page with ?offline (sc-39471, #39546). */
export function OfflineBox({ onRetry, time = '09:32' }: { onRetry: () => void; time?: string }) {
  return (
    <div role="status">
      <OfflineBoxLook words={W.offline(time)} onRetry={onRetry} />
    </div>
  );
}

export function DemoOffline({ on = false }: { on?: boolean }) {
  const [params] = useSearchParams();
  const [offline, setOffline] = useState(on || params.has('offline'));

  return offline ? <OfflineBox onRetry={() => setOffline(false)} /> : null;
}
