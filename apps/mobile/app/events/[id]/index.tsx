import { useLocalSearchParams } from 'expo-router';

import { EventsScreen } from '../../../src/components/EventsScreen.tsx';

/** A link to one event opens Events with it chosen; back leads to the list. */
export default function LinkedEvent() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();

  return <EventsScreen linked={id} />;
}
