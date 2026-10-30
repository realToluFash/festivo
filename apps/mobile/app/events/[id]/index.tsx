import { useLocalSearchParams } from 'expo-router';

import { EventsScreen } from '../../../src/components/EventsScreen.tsx';
import { COPIED_FROM } from '../../../src/kit/eventDuplicate.ts';

/** A link to one event opens Events with it chosen; back leads to the list, or from a copy to its original. */
export default function LinkedEvent() {
  const { id = '', [COPIED_FROM]: from } = useLocalSearchParams<{
    id?: string;
    [COPIED_FROM]?: string;
  }>();

  return <EventsScreen linked={id} copiedFrom={from} />;
}
