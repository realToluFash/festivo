import { useLocalSearchParams } from 'expo-router';

import { EditEventScreen } from '../../../src/components/EventFormScreen.tsx';

export default function EditEvent() {
  const { id = '', at } = useLocalSearchParams<{ id?: string; at?: string }>();

  return <EditEventScreen eventId={id} toHosts={at === 'hosts'} />;
}
