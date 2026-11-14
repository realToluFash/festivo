import { useLocalSearchParams } from 'expo-router';

import { EventScreen } from '../../../src/components/EventScreen.tsx';
import { COPIED_FROM, DUPLICATING } from '../../../src/kit/eventDuplicate.ts';
import { choiceOf } from '@soirely/domain';

import {
  EVENT_AREA,
  FROM_HAPPENING_NOW,
  GUESTS_FILTER,
  areaOf,
} from '../../../src/kit/eventNav.ts';

/** An event's page, pushed over whatever opened it; from a copy, back leads to its original. */
export default function EventPage() {
  const {
    id = '',
    [COPIED_FROM]: from,
    [EVENT_AREA]: area,
    [FROM_HAPPENING_NOW]: now,
    [GUESTS_FILTER]: filter,
    [DUPLICATING]: duplicating,
  } = useLocalSearchParams<{
    id?: string;
    [COPIED_FROM]?: string;
    [EVENT_AREA]?: string;
    [FROM_HAPPENING_NOW]?: string;
    [GUESTS_FILTER]?: string;
    [DUPLICATING]?: string;
  }>();

  return (
    <EventScreen
      eventId={id}
      area={areaOf(area)}
      filter={choiceOf(filter ?? null)}
      copiedFrom={from}
      opensDuplicate={duplicating != null}
      keepsTab={now != null}
    />
  );
}
