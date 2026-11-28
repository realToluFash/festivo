import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import { StaffLinkScreen } from '../../../src/components/staff/StaffLinkScreen.tsx';
import { goToArea } from '../../../src/kit/upToEvent.ts';

/** /events/<id>/staff-link?person=<staff id> (sc-77903): one person's own link, opened from the event's Staff. */
export default function EventStaffLink() {
  const { id = '', person = '' } = useLocalSearchParams<{ id?: string; person?: string }>();
  const navigation = useNavigation();

  return (
    <StaffLinkScreen
      key={`${id}/${person}`}
      eventId={id}
      staffId={person}
      onBack={() => goToArea(navigation, router, id, 'staff')}
    />
  );
}
