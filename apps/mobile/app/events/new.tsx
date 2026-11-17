import { roleHolds } from '@soirely/domain';
import { Redirect } from 'expo-router';

import { EventsScreen } from '../../src/components/EventsScreen.tsx';
import { DESTINATION_HREF } from '../../src/kit/appNav.ts';
import { useSignedIn } from '../../src/signedIn.ts';

/** New event over the list: from Today, the Calendar or a link (sc-48607). */
export default function NewEvent() {
  const { organisation } = useSignedIn();

  if (organisation != null && !roleHolds(organisation, 'events.create'))
    return <Redirect href={DESTINATION_HREF.events} />;

  return <EventsScreen opensNew />;
}
