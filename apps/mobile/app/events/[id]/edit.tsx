import { useLocalSearchParams } from 'expo-router';

import { EditEventScreen } from '../../../src/components/EventFormScreen.tsx';
import { editAtOf } from '../../../src/kit/eventNav.ts';

export default function EditEvent() {
  const { id = '', at } = useLocalSearchParams<{ id?: string; at?: string }>();

  return <EditEventScreen eventId={id} at={editAtOf(at)} />;
}
