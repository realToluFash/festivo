import { useLocalSearchParams } from 'expo-router';

import { EventScreen } from '../../../src/components/EventScreen.tsx';
import { editPartOf } from '../../../src/kit/eventNav.ts';

/** A link into the old Edit details: the event's page, with the part `at` names open over it (sc-48600). */
export default function EditEvent() {
  const { id = '', at } = useLocalSearchParams<{ id?: string; at?: string }>();

  return <EventScreen eventId={id} area="overview" opensEdit={editPartOf(at)} keepsTab={false} />;
}
