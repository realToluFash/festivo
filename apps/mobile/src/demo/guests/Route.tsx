import { useLocalSearchParams } from 'expo-router';

import { EventScreen } from '../events/EventPage.tsx';
import { EventsShell } from '../events/Route.tsx';
import { CheckInScreen } from './CheckIn.tsx';
import { doorStateOf, eventOf, guestsStateOf } from './GuestsModel.ts';

/** /demo/guests: the event's Guests by guests-a-spec §15's ?state=, inside the event it opens on. */
export function GuestsRoute() {
  const params = useLocalSearchParams<{ state?: string; switcher?: string }>();
  const state = guestsStateOf(params.state);

  return (
    <EventsShell switcher={params.switcher}>
      <EventScreen
        key={state ?? ''}
        id={eventOf(state)}
        state={null}
        area="guests"
        guests={state ?? 'inUse'}
      />
    </EventsShell>
  );
}

/** /demo/guests/check-in: the door on the day, by its ?state=. */
export function CheckInRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = doorStateOf(params.state);

  return (
    <EventsShell>
      <CheckInScreen key={state ?? ''} state={state} />
    </EventsShell>
  );
}
