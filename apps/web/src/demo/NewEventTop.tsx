import { useSearchParams } from 'react-router';

import { DemoBell } from './DemoBell.tsx';
import { NewEventForm } from './NewEventForm.tsx';
import { newEventStateOf } from './newEvent.ts';
import { Crumb } from '../components/EventPageParts.tsx';
import { TitleRow } from '../components/SettingsParts.tsx';
import { EventsShell } from './EventParts.tsx';
import { CURRENCY_CHOICES, EVENT_WORDS as W } from './events.ts';
import { filledStateOf, fillingOf } from './enquiryToEvent.ts';
import { SIDEBAR_EVENTS, VIEWERS } from './settings.ts';
import { TodaySidebar } from './TodaySidebar.tsx';

/** New event at a desk: sc-39509's top (the crumb row with the bell, then the title) over sc-48607's form. */
export function NewEventTop() {
  const [params] = useSearchParams();
  const filled = params.get('from') === 'enquiry' ? filledStateOf(params.get('state')) : null;
  const from =
    filled == null
      ? null
      : fillingOf(
          filled,
          CURRENCY_CHOICES.map(([code]) => code),
        );

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
            {from == null ? (
              <NewEventForm state={newEventStateOf(params.get('state'))} />
            ) : (
              <NewEventForm key={filled} state={from.as} from={from} />
            )}
          </div>
        </div>
      )}
    </EventsShell>
  );
}
