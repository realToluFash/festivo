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
import { CHANGED, GUESTS_SINCE } from '../../../src/kit/guestChanges.ts';
import { OPENED_GUEST } from '../../../src/kit/searchLinks.ts';
import { ASKS_END } from '../../../src/kit/upToEvent.ts';
import { CAME_FROM } from '../../../src/kit/outsideEvent.ts';
import { SEARCHED_FROM } from '../../../src/kit/eventBack.ts';

/** An event's page, pushed over whatever opened it; from a copy, back leads to its original. A link that swaps the id on a mounted page starts the page afresh, so nothing one event had open reaches another (sc-48601). */
export default function EventPage() {
  const {
    id = '',
    [COPIED_FROM]: from,
    [EVENT_AREA]: area,
    [FROM_HAPPENING_NOW]: now,
    [GUESTS_FILTER]: filter,
    [GUESTS_SINCE]: since,
    [DUPLICATING]: duplicating,
    [OPENED_GUEST]: guest,
    [ASKS_END]: asks,
    [CAME_FROM]: cameFrom,
    [SEARCHED_FROM]: searched,
  } = useLocalSearchParams<{
    id?: string;
    [COPIED_FROM]?: string;
    [EVENT_AREA]?: string;
    [FROM_HAPPENING_NOW]?: string;
    [GUESTS_FILTER]?: string;
    [GUESTS_SINCE]?: string;
    [DUPLICATING]?: string;
    [OPENED_GUEST]?: string;
    [ASKS_END]?: string;
    [CAME_FROM]?: string;
    [SEARCHED_FROM]?: string;
  }>();

  return (
    <EventScreen
      key={id}
      eventId={id}
      area={areaOf(area)}
      filter={filter === CHANGED ? 'all' : choiceOf(filter ?? null)}
      changedSince={filter === CHANGED ? (since ?? 'all') : undefined}
      copiedFrom={from}
      opensDuplicate={duplicating != null}
      keepsTab={now != null}
      opensGuest={guest}
      opensEndNow={asks === 'endNow'}
      cameFrom={cameFrom}
      searched={searched}
    />
  );
}
