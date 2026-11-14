import { useLocalSearchParams } from 'expo-router';

import { DuplicateEventScreen } from '../../../src/components/DuplicateEvent.tsx';

export default function DuplicateEvent() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();

  return <DuplicateEventScreen eventId={id} />;
}
