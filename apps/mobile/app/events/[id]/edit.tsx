import { useLocalSearchParams } from 'expo-router';

import { EventScreen } from '../../../src/components/EventScreen.tsx';
import { EDIT_LEAVES, editPartOf } from '../../../src/kit/eventNav.ts';

/** A link into the old Edit details: the event's page, with the part `at` names open over it (sc-48600). */
export default function EditEvent() {
  const params = useLocalSearchParams<{ id?: string; at?: string; [EDIT_LEAVES]?: string }>();
  const { id = '', at } = params;

  return (
    <EventScreen
      eventId={id}
      area="overview"
      opensEdit={editPartOf(at)}
      editLeaves={params[EDIT_LEAVES] != null}
      keepsTab={false}
    />
  );
}
