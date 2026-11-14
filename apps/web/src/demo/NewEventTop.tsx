import { DemoBell } from './DemoBell.tsx';
import { Crumb } from '../components/EventPageParts.tsx';
import { TitleRow } from '../components/SettingsParts.tsx';
import { EventsShell } from './EventParts.tsx';
import { EVENT_WORDS as W } from './events.ts';
import { SIDEBAR_EVENTS, VIEWERS } from './settings.ts';
import { TodaySidebar } from './TodaySidebar.tsx';

/** New event's top at a desk, once the band has gone (sc-39509): the event pages' crumb row with the bell, then the title. */
export function NewEventTop() {
  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <TodaySidebar
          events={SIDEBAR_EVENTS}
          tell={tell}
          listing
          person={VIEWERS.folake}
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
            <TitleRow title={W.newEvent} compact />
            <p className="demo-muted">
              The form below the title has its own design, and stays as the product draws it.
            </p>
          </div>
        </div>
      )}
    </EventsShell>
  );
}
