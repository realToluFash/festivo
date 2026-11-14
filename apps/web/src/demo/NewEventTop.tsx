import { useSearchParams } from 'react-router';

import { DemoBell } from './DemoBell.tsx';
import { NewEventForm } from './NewEventForm.tsx';
import { newEventStateOf } from './newEvent.ts';
import { Crumb } from '../components/EventPageParts.tsx';
import { TitleRow } from '../components/SettingsParts.tsx';
import { EventsShell } from './EventParts.tsx';
import { EVENT_WORDS as W } from './events.ts';
import { SIDEBAR_EVENTS, VIEWERS } from './settings.ts';
import { TodaySidebar } from './TodaySidebar.tsx';

/** New event at a desk: sc-39509's top (the crumb row with the bell, then the title) over sc-48607's form. */
export function NewEventTop() {
  const [params] = useSearchParams();

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
            <NewEventForm state={newEventStateOf(params.get('state'))} />
          </div>
        </div>
      )}
    </EventsShell>
  );
}
