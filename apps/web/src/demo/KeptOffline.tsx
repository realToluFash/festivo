import { useEffect, useRef } from 'react';

import { TextAction } from '../components/SettingsParts.tsx';
import { OfflineBox } from './DemoOffline.tsx';
import { EventsShell } from './EventParts.tsx';
import { EVENT_WORDS as W, TODAY_IDS, sampleEvent } from './events.ts';
import { SIDEBAR_EVENTS } from './settings.ts';
import type { Kept } from './tabKept.ts';
import { TodaySidebar } from './TodaySidebar.tsx';

/** sc-65646: offline, an area of an event this tab has loaded stands under the amber box, as of when the event last loaded. */
export function KeptBox({ kept }: { kept: Kept }) {
  if (!kept.offline || kept.asOf == null) return null;

  return <OfflineBox time={kept.asOf} onRetry={kept.retry} />;
}

/** An event this tab never loaded, opened offline: the shell has nothing to keep, so it says the event did not load, under the organisation's sidebar. */
export function EventNotLoaded({ id, onRetry }: { id: string; onRetry: () => void }) {
  const heading = useRef<HTMLParagraphElement>(null);

  useEffect(() => heading.current?.focus(), []);

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <TodaySidebar
          events={SIDEBAR_EVENTS.filter(
            (key) => TODAY_IDS[key] !== id && sampleEvent(TODAY_IDS[key]) != null,
          )}
          tell={tell}
          listing
          inert={covered}
        />
      )}
    >
      {() => (
        <div className="desk-page ev-page">
          <div className="ev-wide">
            <div className="desk-failed" role="alert">
              <p ref={heading} className="desk-line" tabIndex={-1}>
                {W.eventFailed}
              </p>
              <TextAction label={W.retry} onClick={onRetry} />
            </div>
          </div>
        </div>
      )}
    </EventsShell>
  );
}
