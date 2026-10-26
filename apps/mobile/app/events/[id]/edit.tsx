import { useLocalSearchParams } from 'expo-router';

import { EditEventScreen } from '../../../src/components/EventFormScreen.tsx';

export default function EditEvent() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();

  return <EditEventScreen eventId={id} />;
}
