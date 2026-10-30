import { useLocalSearchParams } from 'expo-router';

import { EventsScreen } from '../../../src/components/EventsScreen.tsx';

/** A link to one event opens Events with it chosen; back leads to the list, or from a copy to its original. */
export default function LinkedEvent() {
  const { id = '', from } = useLocalSearchParams<{ id?: string; from?: string }>();

  return <EventsScreen linked={id} copiedFrom={from} />;
}
