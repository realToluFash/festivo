import { useLocalSearchParams } from 'expo-router';

import { EventScreen } from '../../../src/components/EventScreen.tsx';
import { EDIT_AT_PARAM, EDIT_LEAVES, editPartOf } from '../../../src/kit/eventNav.ts';

/** A link into the old Edit details: the event's page, with the part `at` names open over it (sc-48600). */
export default function EditEvent() {
  const params = useLocalSearchParams<{
    id?: string;
    [EDIT_AT_PARAM]?: string;
    [EDIT_LEAVES]?: string;
  }>();
  const { id = '' } = params;

  return (
    <EventScreen
      eventId={id}
      area="overview"
      opensEdit={editPartOf(params[EDIT_AT_PARAM])}
      editLeaves={params[EDIT_LEAVES] != null}
      keepsTab={false}
    />
  );
}
