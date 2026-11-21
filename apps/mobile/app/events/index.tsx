import { useLocalSearchParams } from 'expo-router';

import { EventsScreen } from '../../src/components/EventsScreen.tsx';
import { EVENTS_SEARCHED } from '../../src/kit/searchLinks.ts';

export default function Events() {
  const { [EVENTS_SEARCHED]: searched } = useLocalSearchParams<{ [EVENTS_SEARCHED]?: string }>();

  return <EventsScreen key={searched ?? ''} searched={searched} />;
}
