import { useLocalSearchParams } from 'expo-router';

import { type PeopleParams } from './People.tsx';
import { doorStartOf } from '../doorCode/DoorCodeModel.ts';
import { EventsShell } from '../events/Route.tsx';
import { EventScreen } from '../events/EventPage.tsx';
import { DOOR_WEDDING } from '../events/EventsSample.ts';
import { SAMPLE_EVENT_ID } from '../messages/MessagesSample.ts';

/** /demo/people: People in its event's frame as every area is, on the iPad (sc-67665) and the phone (sc-70351); the door code's states in its own event's frame, Joana & Rui's (sc-72). */
export function PeopleRoute() {
  const params = useLocalSearchParams<PeopleParams>();
  const door = doorStartOf(params.state, params.code, params.show ?? params.hold);

  return (
    <EventsShell>
      <EventScreen
        id={door == null ? SAMPLE_EVENT_ID : DOOR_WEDDING.id}
        state={null}
        area="people"
        peopleParams={params}
      />
    </EventsShell>
  );
}
