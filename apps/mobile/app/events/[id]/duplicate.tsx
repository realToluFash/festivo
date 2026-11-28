import { Redirect, useLocalSearchParams } from 'expo-router';

import { DUPLICATING } from '../../../src/kit/eventDuplicate.ts';

/** A link to Duplicate opens the event's page with Duplicate over it. */
export default function DuplicateEvent() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();

  return <Redirect href={`/events/${encodeURIComponent(id)}?${DUPLICATING}=1`} />;
}
