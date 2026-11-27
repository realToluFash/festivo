import { useLocalSearchParams } from 'expo-router';

import { EventScreen } from '../events/EventPage.tsx';
import { EventsShell } from '../events/Route.tsx';
import { CheckInScreen } from './CheckIn.tsx';
import { doorStateOf, eventOf, guestsStateOf } from './GuestsModel.ts';
import { seatingOf } from './DoorSeats.ts';
import { ScannerScreen } from './Scanner.tsx';
import { doorFromOf, scanStateOf, searchAskOf, waitingOf } from './ScanModel.ts';

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

/** /demo/guests/check-in: the door on the day, by its ?state=, &seats=none for an event nobody is seated on, and &from=night when Your night opened it (‹ Your night). */
export function CheckInRoute() {
  const params = useLocalSearchParams<{
    state?: string;
    focus?: string;
    tap?: string;
    seats?: string;
    from?: string;
  }>();
  const state = doorStateOf(params.state);
  const seating = seatingOf(params.seats);

  return (
    <EventsShell>
      <CheckInScreen
        key={`${state ?? ''}.${seating}.${params.from ?? ''}`}
        state={state}
        seating={seating}
        searchAsk={searchAskOf(params)}
        from={doorFromOf(params.from)}
      />
    </EventsShell>
  );
}

/** /demo/guests/scan: Scan a code (sc-1301), by guests-a-spec §19's ?state=, &waiting= for the offline count, &seats=none, and &from=night carried back to Check-in. */
export function ScanRoute() {
  const params = useLocalSearchParams<{
    state?: string;
    waiting?: string;
    seats?: string;
    from?: string;
  }>();
  const state = scanStateOf(params.state);
  const waiting = waitingOf(params.waiting);
  const seating = seatingOf(params.seats);
  const from = doorFromOf(params.from);

  return (
    <EventsShell>
      <ScannerScreen
        key={`${state ?? ''}.${waiting}.${seating}.${from}`}
        state={state}
        waiting={waiting}
        seating={seating}
        from={from}
      />
    </EventsShell>
  );
}
