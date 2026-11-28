import { router, useLocalSearchParams, useNavigation } from 'expo-router';

import { StaffHoursScreen } from '../../../src/components/StaffHoursScreen.tsx';
import { goToArea } from '../../../src/kit/upToEvent.ts';

/** /events/<id>/hours (sc-234): the event's hours worked, opened from its Staff. */
export default function EventHours() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();

  return <StaffHoursScreen eventId={id} onBack={() => goToArea(navigation, router, id, 'staff')} />;
}
