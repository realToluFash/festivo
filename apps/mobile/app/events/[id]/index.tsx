import { useLocalSearchParams } from 'expo-router';

import { EventScreen } from '../../../src/components/EventScreen.tsx';
import { COPIED_FROM } from '../../../src/kit/eventDuplicate.ts';
import { EVENT_AREA, FROM_HAPPENING_NOW, areaOf } from '../../../src/kit/eventNav.ts';

/** An event's page, pushed over whatever opened it; from a copy, back leads to its original. */
export default function EventPage() {
  const {
    id = '',
    [COPIED_FROM]: from,
    [EVENT_AREA]: area,
    [FROM_HAPPENING_NOW]: now,
  } = useLocalSearchParams<{
    id?: string;
    [COPIED_FROM]?: string;
    [EVENT_AREA]?: string;
    [FROM_HAPPENING_NOW]?: string;
  }>();

  return <EventScreen eventId={id} area={areaOf(area)} copiedFrom={from} keepsTab={now != null} />;
}
