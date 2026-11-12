import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { TextAction } from '../components/SettingsParts.tsx';
import { EVENT_WORDS as W } from './events.ts';
import './events.css';

/** The amber box above a page's title while offline: Events', and on the Calendar and every Settings page with ?offline (sc-39471, #39546). */
export function OfflineBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="ev-offline" role="status">
      <span className="ev-offline-mark" aria-hidden="true" />
      <span className="today-grow">{W.offline('09:32')}</span>
      <TextAction label={W.retry} onClick={onRetry} />
    </div>
  );
}

export function DemoOffline({ on = false }: { on?: boolean }) {
  const [params] = useSearchParams();
  const [offline, setOffline] = useState(on || params.has('offline'));

  return offline ? <OfflineBox onRetry={() => setOffline(false)} /> : null;
}
