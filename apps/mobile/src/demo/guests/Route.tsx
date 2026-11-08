import { useLocalSearchParams } from 'expo-router';

import { EventScreen } from '../events/EventPage.tsx';
import { EventsShell } from '../events/Route.tsx';
import { CheckInScreen } from './CheckIn.tsx';
import { doorStateOf, eventOf, guestsStateOf } from './GuestsModel.ts';
import { ScannerScreen } from './Scanner.tsx';
import { scanStateOf, waitingOf } from './ScanModel.ts';

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

/** /demo/guests/scan: Scan a code (sc-1301), by guests-a-spec §19's ?state=, and &waiting= for the offline count. */
export function ScanRoute() {
  const params = useLocalSearchParams<{ state?: string; waiting?: string }>();
  const state = scanStateOf(params.state);
  const waiting = waitingOf(params.waiting);

  return (
    <EventsShell>
      <ScannerScreen key={`${state ?? ''}.${waiting}`} state={state} waiting={waiting} />
    </EventsShell>
  );
}
