import { useEffect, useRef } from 'react';

import { Crumb } from '../components/EventPageParts.tsx';
import { Skeleton } from '../components/Skeleton.tsx';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { EVENT_WORDS as W, TODAY_IDS, sampleEvent } from './events.ts';
import { SIDEBAR_EVENTS } from './settings.ts';
import { TodaySidebar } from './TodaySidebar.tsx';

const LOADING = 'Loading the event…';
const NOT_FOUND = 'This event is not available';

/** sc-80863: before the event has loaded, the page stands under the organisation's own sidebar, its switcher still naming the one being worked in. */
function Waiting({ id, loading }: { id: string; loading: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!loading) heading.current?.focus();
  }, [loading]);

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
      {(tell) => (
        <div className="desk-page ev-page">
          <div className="ev-wide">
            <Crumb to="/demo/events" back={W.back} name={null}>
              <DemoBell tell={tell} />
            </Crumb>
            {loading ? (
              <Skeleton
                words={LOADING}
                shape="cards"
                titled
                cards={[{ cover: true, lines: 2 }, { lines: 3 }, { lines: 2 }]}
              />
            ) : (
              <section className="card">
                <h1 ref={heading} tabIndex={-1}>
                  {NOT_FOUND}
                </h1>
              </section>
            )}
          </div>
        </div>
      )}
    </EventsShell>
  );
}

export function EventLoading({ id }: { id: string }) {
  return <Waiting id={id} loading />;
}

/** The same for a Member with no role on it, an organisation the account is not in, and no such event: it says nothing of which. */
export function EventUnavailable({ id }: { id: string }) {
  return <Waiting id={id} loading={false} />;
}
