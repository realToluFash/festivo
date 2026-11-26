import { router, useLocalSearchParams } from 'expo-router';

import { WhosHereScreen } from '../../../src/components/WhosHereScreen.tsx';

/** /events/<id>/whos-here (sc-3918): who has clocked in tonight, for the staff's readers and the event's leads. */
export default function EventWhosHere() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/events/${id}`));

  return <WhosHereScreen eventId={id} onBack={back} />;
}
